"""Canonical Arnold-RG project registry and idempotent import.

The live database is not touched unless apply() is called. Kingdom Life
(slug kingdom-life / repo kingdom-life-krakow) is never modified.
Private repos are skipped unless include_private=True.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.clients.models import Client
from app.modules.projects.models import Project
from app.modules.projects.service import DEFAULT_INTEGRATIONS, slugify, unique_slug
from app.modules.websites.models import Website

Kind = Literal["own_product", "client"]

GITHUB_OWNER = "Arnold-RG"
PROTECTED_SLUGS = frozenset({"kingdom-life"})
PROTECTED_REPOS = frozenset({"kingdom-life-krakow"})

# Client records created (or reused by exact name) for client-typed projects.
CLIENTS = (
    {"key": "boutique-la-difference", "name": "Boutique La Différence",
     "city": "Kigali", "country": "RW", "sector": "retail", "status": "active",
     "notes": "Neighborhood supermarket in Zindiro, Kigali. Registry client."},
    {"key": "hamwe", "name": "Hamwe Tourism",
     "city": "Kigali", "country": "RW", "sector": "tourism", "status": "active",
     "notes": "Rwanda tours for small groups, hosted from Kigali. Registry client."},
)


@dataclass(frozen=True)
class Site:
    label: str
    url: str


@dataclass(frozen=True)
class RegistryEntry:
    slug: str
    name: str
    kind: Kind
    category: str
    repo_name: str
    summary: str
    production_url: str | None = None
    staging_url: str | None = None
    sites: tuple[Site, ...] = ()
    client_key: str | None = None
    private: bool = False
    priority: str = "medium"
    status: str = "active"


def _site(label: str, url: str) -> Site:
    return Site(label, url)


def _pages(repo: str) -> str:
    return f"https://arnold-rg.github.io/{repo}/"


# Official catalogue (public first). Live Render apps are included where they exist.
ENTRIES: tuple[RegistryEntry, ...] = (
    RegistryEntry(
        "ragi", "RAGI", "own_product", "operations", "ragi",
        "Operations hub: project progress, agents, activity and website gallery.",
        "https://arnova-ragi.onrender.com",
        sites=(_site("RAGI (live, owner only)", "https://arnova-ragi.onrender.com"),
               _site("RAGI (GitHub Pages)", _pages("ragi"))),
        priority="critical",
    ),
    RegistryEntry(
        "our-money-hub", "Our Money Hub", "own_product", "finance", "our-money-hub",
        "Household money ledger: income, expenses, savings, project budgets and live FX.",
        "https://arnova-omh.onrender.com",
        sites=(_site("Our Money Hub (live, owner only)", "https://arnova-omh.onrender.com"),
               _site("Our Money Hub (GitHub Pages)", _pages("our-money-hub"))),
        priority="critical",
    ),
    RegistryEntry(
        "2daymovie", "2DayMovie", "own_product", "entertainment", "2daymovie",
        "Discovery site for official YouTube film, series and kids' uploads.",
        "https://twodaymovie-site.onrender.com",
        "https://twodaymovie-preview.onrender.com",
        sites=(_site("2DayMovie (Render, current homepage)", "https://twodaymovie-site.onrender.com"),
               _site("2DayMovie (GitHub Pages)", _pages("2daymovie")),
               _site("2DayMovie (Render, older hostname)", "https://twodaymovie.onrender.com")),
        priority="high",
    ),
    RegistryEntry(
        "arnold-portfolio", "Arnold Rurangwa portfolio", "own_product", "portfolio", "arnold-portfolio",
        "Official engineering folio and resume.",
        _pages("arnold-portfolio"),
        sites=(_site("Official portfolio", _pages("arnold-portfolio")),),
    ),
    RegistryEntry(
        "github-profile", "GitHub profile site", "own_product", "portfolio", "Arnold-RG",
        "Public GitHub profile site for Arnold Rurangwa.",
        _pages("Arnold-RG"),
        sites=(_site("GitHub profile site", _pages("Arnold-RG")),),
        priority="low",
    ),
    RegistryEntry(
        "arnova-group", "Arnova Group Agency", "own_product", "agency-website", "arnova-group",
        "Company website for websites, apps and local visibility work.",
        _pages("arnova-group"),
        "https://arnova-africa-preview.onrender.com",
        sites=(_site("Arnova Group Agency", _pages("arnova-group")),
               _site("Arnova Group Agency (Render preview)", "https://arnova-africa-preview.onrender.com")),
        priority="high",
    ),
    RegistryEntry(
        "abroadcost", "AbroadCost", "own_product", "product", "AbroadCost",
        "Country budget planner for living costs, travel budgets and salaries.",
        _pages("AbroadCost"),
        sites=(_site("AbroadCost", _pages("AbroadCost")),),
    ),
    RegistryEntry(
        "elvora", "Elvora", "own_product", "mobile-app", "elvora",
        "On-device health coach for food, training, hydration and recovery.",
        _pages("elvora"),
        "https://elvora-app-preview.onrender.com",
        sites=(_site("Elvora", _pages("elvora")),
               _site("Elvora app preview (Render)", "https://elvora-app-preview.onrender.com")),
    ),
    RegistryEntry(
        "peakwise", "Peakwise", "own_product", "product", "peakwise",
        "Name the molecule in a mass spectrum. Formerly IonScribe.",
        _pages("peakwise"),
        sites=(_site("Peakwise", _pages("peakwise")),),
    ),
    RegistryEntry(
        "stans", "STANS", "own_product", "product", "STANS",
        "Live OpenStreetMap traffic desk: search, routing, GPS and weather.",
        _pages("STANS"),
        sites=(_site("STANS", _pages("STANS")),),
    ),
    RegistryEntry(
        "study-atlas", "Study Atlas", "own_product", "product", "study-atlas",
        "AI and data-science curriculum: stages, quizzes and tests.",
        _pages("study-atlas"),
        sites=(_site("Study Atlas", _pages("study-atlas")),),
    ),
    RegistryEntry(
        "worldshield-soc", "WorldShield SOC", "own_product", "cybersecurity", "worldshield-soc",
        "Global cyber threat dashboard from public feeds. Formerly Africa Shield Cyber Centre.",
        _pages("worldshield-soc"),
        sites=(_site("WorldShield SOC", _pages("worldshield-soc")),),
        priority="high",
    ),
    RegistryEntry(
        "log-analyzer", "Log analyzer", "own_product", "tool", "log-analyzer",
        "Find failed logons, brute force, lockouts and sudo misuse in system logs.",
        status="active",
    ),
    RegistryEntry(
        "network-monitor", "Network monitor", "own_product", "tool", "network-monitor",
        "Detect new devices joining a local network.",
    ),
    RegistryEntry(
        "network-scanner", "Network scanner", "own_product", "tool", "network-scanner",
        "Discover live hosts on a local IPv4 subnet.",
    ),
    RegistryEntry(
        "port-scanner", "Port scanner", "own_product", "tool", "port-scanner",
        "TCP connect port scanner for hosts, ranges and CIDR blocks.",
    ),
    RegistryEntry(
        "security-hardening-checker", "Security hardening checker", "own_product", "tool",
        "security-hardening-checker",
        "Read-only Windows and Linux security hardening audits.",
    ),
    RegistryEntry(
        "boutique-la-difference", "Boutique La Différence", "client", "client-website",
        "Boutique-la-difference",
        "Neighborhood supermarket storefront in Zindiro, Kigali.",
        _pages("Boutique-la-difference"),
        sites=(_site("Boutique La Différence", _pages("Boutique-la-difference")),),
        client_key="boutique-la-difference",
        priority="high",
    ),
    RegistryEntry(
        "hamwe", "Hamwe Tourism", "client", "client-website", "hamwe",
        "Full Rwanda tours for small groups, hosted from Kigali.",
        _pages("hamwe"),
        sites=(_site("Hamwe Tourism", _pages("hamwe")),),
        client_key="hamwe",
        priority="high",
    ),
    # Private — off by default.
    RegistryEntry(
        "boutique-la-difference-office", "Boutique La Différence office", "client", "client-website",
        "boutique-la-difference-office",
        "Private office server for Boutique La Différence.",
        "https://boutique-la-difference-office.onrender.com",
        sites=(_site("Boutique office (Render, private)",
                     "https://boutique-la-difference-office.onrender.com"),),
        client_key="boutique-la-difference",
        private=True,
        priority="medium",
    ),
    RegistryEntry(
        "stans-archived-fork", "STANS archived fork", "own_product", "product",
        "STANS-archived-fork",
        "Private archive of an earlier STANS snapshot. The public project is STANS.",
        private=True,
        priority="low",
        status="paused",
    ),
)


def catalog(*, include_private: bool = False) -> list[RegistryEntry]:
    return [e for e in ENTRIES if include_private or not e.private]


def is_protected(project: Project | None = None, *, slug: str | None = None, repo_name: str | None = None) -> bool:
    if project is not None:
        slug = project.slug
        repo_name = project.repo_name
    if slug and slug in PROTECTED_SLUGS:
        return True
    if repo_name and repo_name in PROTECTED_REPOS:
        return True
    return False


def _find_project(db: Session, org_id: str, entry: RegistryEntry) -> Project | None:
    by_repo = db.scalar(select(Project).where(
        Project.organization_id == org_id,
        Project.repo_owner == GITHUB_OWNER,
        Project.repo_name == entry.repo_name,
    ))
    if by_repo:
        return by_repo
    return db.scalar(select(Project).where(Project.organization_id == org_id, Project.slug == entry.slug))


def _find_client(db: Session, org_id: str, name: str) -> Client | None:
    return db.scalar(select(Client).where(Client.organization_id == org_id, Client.name == name))


def plan(db: Session, org_id: str, *, include_private: bool = False) -> list[dict]:
    """Describe what apply() would do. Does not write."""
    rows: list[dict] = []
    # Existing protected project, even if not in the catalogue.
    existing_protected = db.scalars(select(Project).where(Project.organization_id == org_id)).all()
    seen_ids: set[str] = set()
    for entry in catalog(include_private=include_private):
        project = _find_project(db, org_id, entry)
        item = {
            "name": entry.name,
            "slug": entry.slug,
            "kind": entry.kind,
            "repo": f"{GITHUB_OWNER}/{entry.repo_name}",
            "private": entry.private,
            "production_url": entry.production_url,
            "sites": len(entry.sites),
        }
        if project and is_protected(project):
            item["action"] = "skip_protected"
            item["detail"] = "Kingdom Life is left untouched"
            seen_ids.add(project.id)
        elif project is None:
            item["action"] = "create"
            item["detail"] = f"New {entry.kind.replace('_', ' ')}"
        else:
            item["action"] = "update"
            item["detail"] = "Refresh registry fields and websites; leave tasks as they are"
            seen_ids.add(project.id)
        rows.append(item)
    for project in existing_protected:
        if project.id in seen_ids or not is_protected(project):
            continue
        rows.append({
            "name": project.name, "slug": project.slug, "kind": "client",
            "repo": f"{project.repo_owner}/{project.repo_name}" if project.repo_name else None,
            "private": False, "production_url": project.production_url, "sites": 0,
            "action": "skip_protected", "detail": "Already in RAGI; left untouched",
        })
    skipped_private = [e for e in ENTRIES if e.private] if not include_private else []
    for entry in skipped_private:
        rows.append({
            "name": entry.name, "slug": entry.slug, "kind": entry.kind,
            "repo": f"{GITHUB_OWNER}/{entry.repo_name}", "private": True,
            "production_url": entry.production_url, "sites": len(entry.sites),
            "action": "skip_private", "detail": "Private repo; pass include_private to include",
        })
    return rows


def _ensure_clients(db: Session, org_id: str) -> dict[str, Client]:
    out: dict[str, Client] = {}
    for spec in CLIENTS:
        client = _find_client(db, org_id, spec["name"])
        if client is None:
            client = Client(
                organization_id=org_id, name=spec["name"], city=spec.get("city"),
                country=spec.get("country") or "RW", sector=spec.get("sector"),
                status=spec.get("status") or "active", notes=spec.get("notes"), is_demo=False,
            )
            db.add(client)
            db.flush()
        out[spec["key"]] = client
    return out


def apply(db: Session, org_id: str, *, include_private: bool = False) -> list[dict]:
    """Idempotent upsert. Returns the same actions as plan(), after writing."""
    clients = _ensure_clients(db, org_id)
    planned = plan(db, org_id, include_private=include_private)
    for entry in catalog(include_private=include_private):
        project = _find_project(db, org_id, entry)
        if project and is_protected(project):
            continue
        client_id = clients[entry.client_key].id if entry.client_key else None
        if project is None:
            slug = entry.slug
            if db.scalar(select(Project.id).where(Project.organization_id == org_id, Project.slug == slug)):
                slug = unique_slug(db, org_id, slugify(entry.name))
            project = Project(
                organization_id=org_id, slug=slug, name=entry.name, category=entry.category,
                status=entry.status, priority=entry.priority, summary=entry.summary,
                repo_provider="github", repo_owner=GITHUB_OWNER, repo_name=entry.repo_name,
                production_url=entry.production_url, staging_url=entry.staging_url,
                integrations=DEFAULT_INTEGRATIONS, verified=False, is_demo=False,
                kind=entry.kind, visibility="private" if entry.private else "public",
                is_private=entry.private, client_id=client_id,
            )
            db.add(project)
            db.flush()
        else:
            project.name = entry.name
            project.category = entry.category
            project.summary = entry.summary
            project.repo_provider = "github"
            project.repo_owner = GITHUB_OWNER
            project.repo_name = entry.repo_name
            if entry.production_url:
                project.production_url = entry.production_url
            if entry.staging_url:
                project.staging_url = entry.staging_url
            project.kind = entry.kind
            project.visibility = "private" if entry.private else "public"
            project.is_private = entry.private
            if client_id:
                project.client_id = client_id
        existing_urls = {w.url for w in db.scalars(select(Website).where(Website.project_id == project.id))}
        for site in entry.sites:
            if site.url in existing_urls:
                continue
            db.add(Website(organization_id=org_id, project_id=project.id, label=site.label, url=site.url))
    db.flush()
    return planned


def format_plan(rows: list[dict]) -> str:
    lines = ["name | kind | action | detail"]
    for r in rows:
        lines.append(f"{r['name']} | {r['kind']} | {r['action']} | {r.get('detail') or ''}")
    return "\n".join(lines)
