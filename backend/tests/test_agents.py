from sqlalchemy import select

from app.modules.agents.models import Agent
from tests.conftest import login


def test_roster_is_owner_team_placeholders(world):
    agents = login("op@ragi.local").get("/api/v1/agents").json()
    assert [a["slug"] for a in agents] == ["forge", "jarvis", "mentor", "nova", "sentinel"]
    assert all(a["placeholder"] and not a["enabled"] and a["connection"] == "not_connected" for a in agents)


def test_dispatch_blocked_by_emergency_stop_with_evidence(world):
    c = login("op@ragi.local")
    run = c.post("/api/v1/agents/forge/dispatch", json={"capability": "code_review"}).json()
    assert run["status"] == "blocked"
    checks = {ch["name"]: ch["passed"] for ch in run["checks"]}
    assert checks["emergency_stop"] is False and checks["budget_reserved"] is False


def test_agent_runs_scoped_to_organization(world):
    login("op@ragi.local").post("/api/v1/agents/forge/dispatch", json={})
    other = login("op@other.local")
    assert other.get("/api/v1/agent-runs").json() == []
    mine = login("op@ragi.local").get("/api/v1/agent-runs").json()
    assert len(mine) == 1


def test_cannot_dispatch_other_orgs_agent(world, db):
    other_agent = db.scalar(select(Agent).where(Agent.organization_id == world.other_org.id, Agent.slug == "forge"))
    assert login("op@ragi.local").post(f"/api/v1/agents/{other_agent.id}/dispatch", json={}).status_code == 404


def test_task_cannot_be_assigned_to_other_orgs_agent(world, db):
    other_agent = db.scalar(select(Agent).where(Agent.organization_id == world.other_org.id, Agent.slug == "nova"))
    r = login("op@ragi.local").post("/api/v1/tasks", json={"title": "Research", "assignee_kind": "agent",
                                                         "assignee_agent_id": other_agent.id})
    assert r.status_code == 422


def test_enabling_agent_needs_owner_and_provider(world, as_owner):
    assert login("op@ragi.local").patch("/api/v1/agents/forge", json={"enabled": True}).status_code == 403
    assert as_owner.patch("/api/v1/agents/forge", json={"enabled": True}).status_code == 409


def test_capability_kept_after_approval(world, db, monkeypatch):
    """When everything else passes, a run waits for the owner; re-evaluation keeps the capability check."""
    from app.core.config import get_settings
    from app.integrations.providers.base import ProviderStatus
    import app.modules.agents.guard as guard

    monkeypatch.setattr(get_settings(), "agents_enabled", True)
    monkeypatch.setattr(guard, "provider_status", lambda name: ProviderStatus(name, True, "test"))
    a = db.scalar(select(Agent).where(Agent.organization_id == world.org.id, Agent.slug == "forge"))
    a.enabled = True
    db.commit()
    c = login("op@ragi.local")
    run = c.post("/api/v1/agents/forge/dispatch", json={"capability": "time_travel"}).json()
    assert run["status"] == "blocked"  # lacks capability
    run = c.post("/api/v1/agents/forge/dispatch", json={"capability": "code_review"}).json()
    assert run["status"] == "pending_approval"
    owner = login("owner@ragi.local", world.totp_secret)
    appr = [x for x in owner.get("/api/v1/approvals?status=pending").json() if x["kind"] == "agent_run"][0]
    owner.post(f"/api/v1/approvals/{appr['id']}/decide", json={"decision": "approved"})
    runs = {r["id"]: r for r in owner.get("/api/v1/agent-runs").json()}
    after = runs[run["id"]]
    assert "capability" in {ch["name"] for ch in after["checks"]}
    assert after["status"] == "blocked"  # OMH not connected → budget unavailable, fails closed
