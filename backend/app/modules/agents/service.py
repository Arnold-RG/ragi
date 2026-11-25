from datetime import UTC, datetime

import yaml
from pathlib import Path
from sqlalchemy.orm import Session

from app.database.base import new_id
from app.modules.agents.guard import evaluate
from app.modules.agents.models import Agent, AgentRun
from app.modules.projects.models import Project
from app.modules.tasks.models import Task

PROFILES_DIR = Path(__file__).resolve().parents[3] / "agent_profiles"


def load_profiles() -> list[dict]:
    return [yaml.safe_load(p.read_text())["agent"] for p in sorted(PROFILES_DIR.glob("*.yaml"))]


def sync_profiles(db: Session, organization_id: str) -> int:
    """Upsert agent profiles from YAML for one organization. `enabled` is never switched on from files."""
    from sqlalchemy import select

    n = 0
    for prof in load_profiles():
        a = db.scalar(select(Agent).where(Agent.organization_id == organization_id, Agent.slug == prof["id"]))
        fields = dict(display_name=prof["display_name"], department=prof["department"], role=prof.get("role", ""),
                      provider=prof["provider"], placeholder=prof.get("placeholder", False), capabilities=prof.get("capabilities", []),
                      permissions=prof.get("permissions", {}), execution=prof.get("execution", {}),
                      financial_controls=prof.get("financial_controls", {}), governance=prof.get("governance", {}))
        if a is None:
            db.add(Agent(organization_id=organization_id, slug=prof["id"], enabled=False, **fields))
            n += 1
        else:
            for k, v in fields.items():
                setattr(a, k, v)
    return n


def _project_slug(db: Session, task: Task | None) -> str | None:
    if task and task.project_id:
        p = db.get(Project, task.project_id)
        return p.slug if p else None
    return None


def _status_from(checks: list[dict]) -> tuple[str, str | None]:
    failed = [c for c in checks if not c["passed"]]
    if not failed:
        return "queued", None
    if len(failed) == 1 and failed[0]["name"] == "owner_approval":
        return "pending_approval", failed[0]["detail"]
    return "blocked", "; ".join(c["detail"] for c in failed)


def dispatch(db: Session, agent: Agent, task: Task | None, capability: str | None, requested_by: str) -> AgentRun:
    run_id = new_id()
    checks = evaluate(agent, capability=capability, run_id=run_id, project_slug=_project_slug(db, task), owner_approved=False)
    status, reason = _status_from(checks)
    run = AgentRun(id=run_id, organization_id=agent.organization_id, agent_id=agent.id, capability=capability,
                   task_id=task.id if task else None, requested_by=requested_by,
                   status=status, checks=checks, blocked_reason=reason)
    if status == "blocked":
        run.finished_at = datetime.now(UTC)
    db.add(run)
    return run


def resume_run_after_approval(db: Session, run_id: str, approved: bool) -> None:
    run = db.get(AgentRun, run_id)
    if not run or run.status != "pending_approval":
        return
    if not approved:
        run.status, run.blocked_reason, run.finished_at = "blocked", "Owner rejected the run", datetime.now(UTC)
        return
    agent = db.get(Agent, run.agent_id)
    task = db.get(Task, run.task_id) if run.task_id else None
    run.checks = evaluate(agent, capability=run.capability, run_id=run.id, project_slug=_project_slug(db, task), owner_approved=True)
    run.status, run.blocked_reason = _status_from(run.checks)
    if run.status == "blocked":
        run.finished_at = datetime.now(UTC)
