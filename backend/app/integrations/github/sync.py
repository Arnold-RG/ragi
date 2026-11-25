"""Read-only GitHub sync for the Arnold-RG project registry.

Uses GITHUB_SYNC_TOKEN when set (fine-grained, metadata read). Without a token
the caller gets a clear 'not configured' result; public listing is not attempted
in production because the unauthenticated rate limit is too tight to share with
other jobs. Never logs the token.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.identity.models import InstanceSetting
from app.modules.projects import registry
from app.modules.projects.models import Project
from app.modules.projects.service import DEFAULT_INTEGRATIONS, slugify, unique_slug
from app.modules.showcase.catalog import save_showcase
from app.modules.websites.models import Website

API = "https://api.github.com"
ACCEPT = "application/vnd.github+json"
API_VERSION = "2022-11-28"
LAST_AT = "github_sync_last_at"
LAST_RESULT = "github_sync_last_result"
LAST_OK = "github_sync_last_ok"


class SyncNotConfigured(Exception):
    pass


class SyncRateLimited(Exception):
    def __init__(self, retry_after: int):
        super().__init__(f"GitHub rate limit reached; retry after {retry_after}s")
        self.retry_after = retry_after


def token_configured() -> bool:
    return bool((get_settings().github_sync_token or "").strip())


def status(db: Session) -> dict:
    s = get_settings()
    def _get(key: str) -> str | None:
        row = db.get(InstanceSetting, key)
        return row.value if row else None
    last_ok = _get(LAST_OK)
    return {
        "configured": token_configured(),
        "user": s.github_sync_user,
        "include_private": s.github_sync_include_private,
        "interval_hours": s.github_sync_interval_hours,
        "last_at": _get(LAST_AT),
        "last_result": _get(LAST_RESULT),
        "last_ok": None if last_ok is None else last_ok == "1",
    }


def _headers() -> dict[str, str]:
    token = (get_settings().github_sync_token or "").strip()
    headers = {"Accept": ACCEPT, "X-GitHub-Api-Version": API_VERSION, "User-Agent": "RAGI-github-sync"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _respect_rate_limit(response: httpx.Response) -> None:
    if response.status_code in {403, 429}:
        reset = response.headers.get("X-RateLimit-Reset") or response.headers.get("Retry-After") or "0"
        try:
            raw = int(reset)
        except ValueError:
            raw = 0
        if raw > 1_000_000_000:  # epoch
            wait = max(0, raw - int(datetime.now(UTC).timestamp()))
        else:
            wait = raw
        raise SyncRateLimited(wait or 60)
    remaining = response.headers.get("X-RateLimit-Remaining")
    if remaining is not None and remaining.isdigit() and int(remaining) <= 2:
        reset = int(response.headers.get("X-RateLimit-Reset") or "0")
        wait = max(0, reset - int(datetime.now(UTC).timestamp())) if reset else 60
        raise SyncRateLimited(wait)


def list_repos(client: httpx.Client | None = None) -> list[dict[str, Any]]:
    """Fetch every repo visible to the token for GITHUB_SYNC_USER (paginated)."""
    if not token_configured():
        raise SyncNotConfigured("GITHUB_SYNC_TOKEN is not set")
    s = get_settings()
    user = s.github_sync_user
    own = client or httpx.Client(timeout=20.0, headers=_headers())
    close = client is None
    repos: list[dict[str, Any]] = []
    try:
        url: str | None = f"{API}/users/{user}/repos"
        params: dict | None = {"per_page": 100, "type": "all", "sort": "full_name"}
        # Authenticated: list the caller's visible repos if the user matches, so private ones appear.
        if s.github_sync_include_private:
            url = f"{API}/user/repos"
            params = {"per_page": 100, "affiliation": "owner", "sort": "full_name"}
        while url:
            response = own.get(url, params=params)
            params = None
            _respect_rate_limit(response)
            response.raise_for_status()
            batch = response.json()
            if not isinstance(batch, list):
                raise RuntimeError("Unexpected GitHub response")
            for repo in batch:
                owner = (repo.get("owner") or {}).get("login")
                if owner and owner.lower() != user.lower():
                    continue
                repos.append(repo)
            url = response.links.get("next", {}).get("url")
    finally:
        if close:
            own.close()
    return repos


def _entry_for(repo_name: str) -> registry.RegistryEntry | None:
    for entry in registry.ENTRIES:
        if entry.repo_name.lower() == repo_name.lower():
            return entry
    return None


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _upsert_from_repo(db: Session, org_id: str, repo: dict[str, Any], *, include_private: bool) -> str:
    name = repo.get("name") or ""
    private = bool(repo.get("private"))
    if private and not include_private:
        return "skip_private"
    existing = db.scalar(select(Project).where(
        Project.organization_id == org_id,
        Project.repo_owner == registry.GITHUB_OWNER,
        Project.repo_name == name,
    ))
    if existing and registry.is_protected(existing):
        # Metadata-only? Task says Kingdom Life untouched. Skip entirely.
        return "skip_protected"
    entry = _entry_for(name)
    homepage = (repo.get("homepage") or "").strip() or None
    pages_url = f"https://arnold-rg.github.io/{name}/"
    production = homepage or (pages_url if not private else None)
    if entry and entry.production_url:
        production = entry.production_url
    description = (repo.get("description") or "").strip() or (entry.summary if entry else None)
    pushed = _parse_dt(repo.get("pushed_at"))
    if existing is None:
        slug = (entry.slug if entry else slugify(name))
        if db.scalar(select(Project.id).where(Project.organization_id == org_id, Project.slug == slug)):
            slug = unique_slug(db, org_id, slug)
        project = Project(
            organization_id=org_id, slug=slug, name=(entry.name if entry else name),
            category=(entry.category if entry else "product"),
            status=(entry.status if entry else "unverified"),
            priority=(entry.priority if entry else "medium"),
            summary=description,
            repo_provider="github", repo_owner=registry.GITHUB_OWNER, repo_name=name,
            production_url=production, staging_url=entry.staging_url if entry else None,
            integrations=DEFAULT_INTEGRATIONS, verified=False, is_demo=False,
            kind=(entry.kind if entry else "own_product"),
            visibility="private" if private else "public",
            is_private=private, repo_pushed_at=pushed,
        )
        db.add(project)
        db.flush()
        action = "create"
    else:
        project = existing
        project.repo_provider = "github"
        project.repo_owner = registry.GITHUB_OWNER
        project.repo_name = name
        project.visibility = "private" if private else "public"
        project.is_private = private
        project.repo_pushed_at = pushed
        if description and not project.summary:
            project.summary = description
        if production and not project.production_url:
            project.production_url = production
        if entry:
            project.kind = entry.kind
        action = "update"
    urls = {w.url for w in db.scalars(select(Website).where(Website.project_id == project.id))}
    wanted: list[tuple[str, str]] = []
    if entry:
        wanted.extend((s.label, s.url) for s in entry.sites)
    if homepage:
        wanted.append((f"{project.name} homepage", homepage))
    if not private:
        wanted.append((f"{project.name} (GitHub Pages)", pages_url))
    # Deduplicate by URL, first label wins.
    seen: set[str] = set()
    for label, url in wanted:
        if not url or url in seen or url in urls:
            continue
        seen.add(url)
        # Don't invent a Pages site if GitHub has no homepage and Pages may 404 —
        # still record the conventional Pages URL for public repos; health checks can mark it later.
        db.add(Website(organization_id=org_id, project_id=project.id, label=label, url=url))
    return action


def _put_setting(db: Session, key: str, value: str) -> None:
    row = db.get(InstanceSetting, key)
    if row:
        row.value = value[:500]
    else:
        db.add(InstanceSetting(key=key, value=value[:500]))


def sync(db: Session, org_id: str, *, include_private: bool | None = None,
         client: httpx.Client | None = None) -> dict:
    """Fetch GitHub repos and upsert projects/websites. Regenerates the showcase."""
    s = get_settings()
    include_private = s.github_sync_include_private if include_private is None else include_private
    repos = list_repos(client)
    counts = {"create": 0, "update": 0, "skip_private": 0, "skip_protected": 0}
    for repo in repos:
        action = _upsert_from_repo(db, org_id, repo, include_private=include_private)
        counts[action] = counts.get(action, 0) + 1
    save_showcase(db, org_id)
    now = datetime.now(UTC).isoformat()
    result = (f"{counts['create']} created, {counts['update']} updated, "
              f"{counts['skip_protected']} protected, {counts['skip_private']} private skipped, "
              f"{len(repos)} repos from GitHub")
    _put_setting(db, LAST_AT, now)
    _put_setting(db, LAST_RESULT, result)
    _put_setting(db, LAST_OK, "1")
    db.flush()
    return {"ok": True, "at": now, "result": result, **counts, "repos": len(repos)}


def record_failure(db: Session, message: str) -> None:
    _put_setting(db, LAST_AT, datetime.now(UTC).isoformat())
    _put_setting(db, LAST_RESULT, message[:500])
    _put_setting(db, LAST_OK, "0")
    db.flush()
