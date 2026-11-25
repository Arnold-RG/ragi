"""Build the showcase catalogue from the projects and websites tables."""
from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.projects.models import Project
from app.modules.projects.registry import GITHUB_OWNER
from app.modules.websites.models import Website

WARSAW = ZoneInfo("Europe/Warsaw")


def _kind(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if host.endswith("github.io"):
        return "github_pages"
    if host.endswith("onrender.com"):
        return "render"
    return "website"


def _group(kind: str) -> str:
    if kind == "github_pages":
        return "Websites"
    if kind in {"render", "render_preview"}:
        return "Apps and projects"
    return "Websites"


def _embeddable(kind: str) -> bool:
    # GitHub Pages is usually embeddable. Render apps often send frame blockers or a login wall.
    return kind == "github_pages"


def site_from_website(project: Project, site: Website) -> dict:
    url = site.url
    kind = _kind(url)
    embed = _embeddable(kind)
    repo = None
    if project.repo_owner and project.repo_name:
        repo = f"https://github.com/{project.repo_owner}/{project.repo_name}"
    return {
        "name": site.label or project.name,
        "repo": repo,
        "live_url": url,
        "final_url": url,
        "status": None,
        "kind": kind,
        "embeddable": embed,
        "embeddable_label": "yes" if embed else "open in a new tab",
        "embed_header": None,
        "embed_notes": "GitHub Pages is usually embeddable." if embed else "Opened in a new tab (login or hosted app).",
        "notes": project.summary,
        "homepage_in_repo_metadata": bool(project.production_url),
        "redirects": 0,
        "pages_api_status": None,
        "group": _group(kind),
        "slug": project.slug,
        "project_kind": project.kind,
    }


def build_showcase(db: Session, org_id: str) -> dict | None:
    """Return a showcase payload from DB rows, or None if there is nothing to show yet."""
    projects = list(db.scalars(select(Project).where(
        Project.organization_id == org_id, Project.is_demo.is_(False)).order_by(Project.name)))
    sites: list[dict] = []
    for project in projects:
        rows = list(db.scalars(select(Website).where(Website.project_id == project.id).order_by(Website.label)))
        for row in rows:
            sites.append(site_from_website(project, row))
    if not sites:
        return None
    embeddable = sum(1 for s in sites if s["embeddable"])
    now = datetime.now(UTC)
    local = now.astimezone(WARSAW)
    return {
        "generated_at": now.isoformat(),
        "checked_at_local": local.strftime("%Y-%m-%d %H:%M Europe/Warsaw"),
        "github_user": GITHUB_OWNER,
        "source": "database",
        "summary": {
            "live_sites": len(sites),
            "embeddable": embeddable,
            "open_in_new_tab": len(sites) - embeddable,
        },
        "sites": sites,
    }


# Kept for API symmetry with sync(); showcase is served live from the DB.
def save_showcase(db: Session, org_id: str) -> dict | None:
    return build_showcase(db, org_id)
