"""Project registry import and GitHub sync."""
import json

import httpx
import pytest
from sqlalchemy import select

from app.integrations.github import sync as github_sync
from app.modules.clients.models import Client
from app.modules.projects import registry
from app.modules.projects.models import Project
from app.modules.showcase.catalog import build_showcase
from app.modules.websites.models import Website
from tests.conftest import login


def _kingdom(db, org_id):
    p = Project(organization_id=org_id, slug="kingdom-life", name="Kingdom Life", category="client-website",
                status="active", priority="high", summary="Do not touch this",
                repo_provider="github", repo_owner="Arnold-RG", repo_name="kingdom-life-krakow",
                production_url="https://arnold-rg.github.io/kingdom-life-krakow/", is_demo=False)
    db.add(p)
    db.flush()
    db.add(Website(organization_id=org_id, project_id=p.id, label="Campus site",
                   url="https://arnold-rg.github.io/kingdom-life-krakow/"))
    db.commit()
    return p


def test_catalog_hides_private_by_default():
    public = {e.repo_name for e in registry.catalog()}
    assert "Boutique-la-difference" in public and "hamwe" in public
    assert "ragi" in public and "log-analyzer" in public
    assert "boutique-la-difference-office" not in public
    assert "STANS-archived-fork" not in public
    private = {e.repo_name for e in registry.catalog(include_private=True)}
    assert "boutique-la-difference-office" in private


def test_dry_run_and_apply_leave_kingdom_life_untouched(world, db):
    original = _kingdom(db, world.org.id)
    plan = registry.plan(db, world.org.id)
    actions = {r["slug"]: r["action"] for r in plan}
    assert actions["kingdom-life"] == "skip_protected"
    assert actions["ragi"] == "create"
    assert actions["boutique-la-difference"] == "create"
    assert "boutique-la-difference-office" not in actions or any(r["action"] == "skip_private" for r in plan if r["slug"] == "boutique-la-difference-office")
    registry.apply(db, world.org.id)
    db.commit()
    db.refresh(original)
    assert original.name == "Kingdom Life" and original.summary == "Do not touch this"
    sites = list(db.scalars(select(Website).where(Website.project_id == original.id)))
    assert len(sites) == 1 and sites[0].label == "Campus site"
    boutique = db.scalar(select(Project).where(Project.slug == "boutique-la-difference"))
    hamwe = db.scalar(select(Project).where(Project.slug == "hamwe"))
    assert boutique.kind == "client" and hamwe.kind == "client"
    assert db.scalar(select(Client).where(Client.name == "Boutique La Différence"))
    ragi = db.scalar(select(Project).where(Project.slug == "ragi"))
    assert ragi.kind == "own_product" and ragi.production_url == "https://arnova-ragi.onrender.com"
    tool = db.scalar(select(Project).where(Project.slug == "log-analyzer"))
    assert tool.kind == "own_product" and tool.production_url is None
    # Idempotent
    again = registry.apply(db, world.org.id)
    db.commit()
    assert all(r["action"] in {"update", "skip_protected", "skip_private"} for r in again if r["slug"] != "kingdom-life")
    showcase = build_showcase(db, world.org.id)
    assert showcase and any("twodaymovie-site.onrender.com" in s["live_url"] for s in showcase["sites"])


def test_owner_can_preview_and_apply_registry(world, as_owner, as_operator):
    _kingdom(world.db, world.org.id)
    forbidden = as_operator.get("/api/v1/integrations/registry/plan")
    assert forbidden.status_code == 403
    plan = as_owner.get("/api/v1/integrations/registry/plan")
    assert plan.status_code == 200
    assert any(i["name"] == "2DayMovie" for i in plan.json()["items"])
    applied = as_owner.post("/api/v1/integrations/registry/apply")
    assert applied.status_code == 200 and applied.json()["ok"] is True
    names = [p["name"] for p in as_owner.get("/api/v1/projects").json()]
    assert "2DayMovie" in names and "Kingdom Life" in names


def test_github_sync_status_without_token(as_owner):
    body = as_owner.get("/api/v1/integrations/github/sync").json()
    assert body["configured"] is False
    r = as_owner.post("/api/v1/integrations/github/sync")
    assert r.status_code == 200
    assert r.json()["configured"] is False


def test_github_sync_upserts_and_skips_protected(world, db, monkeypatch):
    _kingdom(db, world.org.id)
    monkeypatch.setattr(github_sync, "token_configured", lambda: True)

    repos = [
        {"name": "kingdom-life-krakow", "private": False, "homepage": "https://example.com/changed",
         "description": "changed", "pushed_at": "2026-11-01T10:00:00Z", "owner": {"login": "Arnold-RG"}},
        {"name": "2daymovie", "private": False, "homepage": "https://twodaymovie-site.onrender.com",
         "description": "From GitHub", "pushed_at": "2026-11-20T10:00:00Z", "owner": {"login": "Arnold-RG"}},
        {"name": "boutique-la-difference-office", "private": True, "homepage": "",
         "description": "office", "pushed_at": "2026-11-20T10:00:00Z", "owner": {"login": "Arnold-RG"}},
    ]

    class FakeClient:
        def __init__(self, *a, **k):
            pass
        def get(self, url, params=None):
            class R:
                status_code = 200
                headers = {"X-RateLimit-Remaining": "100"}
                links = {}
                def json(inner):
                    return repos
                def raise_for_status(inner):
                    return None
            return R()
        def close(self):
            pass

    result = github_sync.sync(db, world.org.id, include_private=False, client=FakeClient())
    db.commit()
    assert result["ok"] and result["create"] >= 1 and result["skip_protected"] == 1
    kingdom = db.scalar(select(Project).where(Project.slug == "kingdom-life"))
    assert kingdom.summary == "Do not touch this"
    assert kingdom.production_url != "https://example.com/changed"
    movie = db.scalar(select(Project).where(Project.repo_name == "2daymovie"))
    assert movie is not None and movie.repo_pushed_at is not None
    assert db.scalar(select(Project).where(Project.repo_name == "boutique-la-difference-office")) is None
    data = build_showcase(db, world.org.id)
    assert data and data["summary"]["live_sites"] >= 1


def test_operator_cannot_sync(as_operator):
    assert as_operator.post("/api/v1/integrations/github/sync").status_code == 403
