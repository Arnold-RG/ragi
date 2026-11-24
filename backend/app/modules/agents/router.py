from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import not_found
from app.core.permissions import Perm
from app.database.session import get_db
from app.events.outbox import publish
from app.integrations.providers.base import provider_status
from app.modules.agents import service
from app.modules.agents.models import Agent, AgentRun
from app.modules.approvals.models import Approval
from app.modules.audit.service import record
from app.modules.identity.deps import require
from app.modules.tasks.models import Task

router = APIRouter(tags=["agents"])


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    slug: str
    display_name: str
    department: str
    role: str
    provider: str
    enabled: bool
    placeholder: bool
    capabilities: list[str]
    permissions: dict
    execution: dict
    financial_controls: dict
    governance: dict
    connection: str = "not_connected"
    connection_detail: str = ""
    run_count: int = 0
    open_tasks: int = 0


class AgentRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    agent_id: str
    agent_slug: str | None = None
    capability: str | None
    task_id: str | None
    task_title: str | None = None
    requested_by: str
    status: str
    checks: list[dict]
    blocked_reason: str | None
    approval_id: str | None
    created_at: datetime
    finished_at: datetime | None


class DispatchRequest(BaseModel):
    task_id: str | None = None
    capability: str | None = Field(default=None, max_length=80)


class AgentToggle(BaseModel):
    enabled: bool


def _agent_out(db: Session, a: Agent) -> AgentOut:
    ps = provider_status(a.provider)
    connected = ps.configured and get_settings().agents_enabled and a.enabled
    return AgentOut.model_validate(a).model_copy(update={
        "connection": "connected" if connected else "not_connected",
        "connection_detail": ps.detail,
        "run_count": db.scalar(select(func.count()).select_from(AgentRun).where(AgentRun.agent_id == a.id)) or 0,
        "open_tasks": db.scalar(select(func.count()).select_from(Task).where(
            Task.organization_id == a.organization_id, Task.assignee_agent_id == a.id, Task.status != "done")) or 0,
    })


def _run_out(db: Session, r: AgentRun) -> AgentRunOut:
    title = db.scalar(select(Task.title).where(Task.id == r.task_id)) if r.task_id else None
    slug = db.scalar(select(Agent.slug).where(Agent.id == r.agent_id))
    return AgentRunOut.model_validate(r).model_copy(update={"task_title": title, "agent_slug": slug})


def _get_agent(db: Session, user, agent_ref: str) -> Agent:
    a = db.scalar(select(Agent).where(Agent.organization_id == user.organization_id,
                                      (Agent.slug == agent_ref) | (Agent.id == agent_ref)))
    if not a:
        raise not_found("Agent")
    return a


@router.get("/agents", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    q = select(Agent).where(Agent.organization_id == user.organization_id).order_by(Agent.slug)
    return [_agent_out(db, a) for a in db.scalars(q).all()]


@router.get("/agents/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: str, db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    return _agent_out(db, _get_agent(db, user, agent_id))


@router.patch("/agents/{agent_id}", response_model=AgentOut)
def toggle_agent(agent_id: str, body: AgentToggle, request: Request, db: Session = Depends(get_db),
                 user=Depends(require(Perm.AGENTS_MANAGE))):
    a = _get_agent(db, user, agent_id)
    if body.enabled and not provider_status(a.provider).configured:
        raise HTTPException(409, "Connect the provider and set an OMH budget before enabling this agent")
    a.enabled = body.enabled
    record(db, user, "agent.enabled" if body.enabled else "agent.disabled", "agent", a.id, request=request)
    if body.enabled:
        publish(db, "agent.registered", {"agent_id": a.slug, "provider": a.provider, "department": a.department})
    db.commit()
    return _agent_out(db, a)


@router.post("/agents/{agent_id}/dispatch", response_model=AgentRunOut, status_code=201)
def dispatch(agent_id: str, body: DispatchRequest, request: Request, db: Session = Depends(get_db),
             user=Depends(require(Perm.AGENTS_DISPATCH))):
    a = _get_agent(db, user, agent_id)
    task = None
    if body.task_id:
        task = db.get(Task, body.task_id)
        if not task or task.organization_id != user.organization_id:
            raise HTTPException(422, "Unknown task")
    run = service.dispatch(db, a, task, body.capability, user.full_name)
    if run.status == "pending_approval":
        appr = Approval(organization_id=user.organization_id, kind="agent_run",
                        title=f"Let {a.display_name} run{(' “' + task.title + '”') if task else ''}",
                        detail="Agent execution needs the owner's OK before any provider call or spend.",
                        subject_type="agent_run", subject_id=run.id, requested_by=user.full_name)
        db.add(appr)
        db.flush()
        run.approval_id = appr.id
    record(db, user, "agent.dispatch", "agent_run", run.id,
           summary=f"Dispatch to {a.display_name}: {run.status.replace('_', ' ')}",
           detail={"agent": a.slug, "status": run.status, "reason": run.blocked_reason}, request=request)
    db.commit()
    return _run_out(db, run)


@router.get("/agent-runs", response_model=list[AgentRunOut])
def list_runs(agent_id: str | None = None, db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    q = select(AgentRun).where(AgentRun.organization_id == user.organization_id)
    if agent_id:
        q = q.where(AgentRun.agent_id == _get_agent(db, user, agent_id).id)
    return [_run_out(db, r) for r in db.scalars(q.order_by(AgentRun.created_at.desc()).limit(100)).all()]
