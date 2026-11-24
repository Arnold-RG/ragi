from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.money import quantize
from app.core.permissions import Perm
from app.database.session import get_db
from app.modules.agents.models import Agent, AgentRun
from app.modules.approvals.models import Approval
from app.modules.audit.models import AuditLog
from app.modules.clients.models import Client
from app.modules.identity.deps import require
from app.modules.projects import service as project_service
from app.modules.projects.models import Project
from app.modules.tasks.models import Task, TaskEvent
from app.modules.websites.models import Website
from app.modules.billing.models import BillingHandoff
from app.modules.leads.models import Lead
from app.modules.retainers.models import Retainer
from app.modules.retainers.router import _out as retainer_out
from app.modules.time_tracking.models import TimeEntry

router = APIRouter(tags=["dashboard"])


def _count(db: Session, stmt) -> int:
    return db.scalar(stmt) or 0


@router.get("/dashboard/summary")
def summary(db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    org = user.organization_id
    s = get_settings()
    proj_by_status = dict(db.execute(
        select(Project.status, func.count()).where(Project.organization_id == org).group_by(Project.status)).all())
    task_by_status = dict(db.execute(
        select(Task.status, func.count()).where(Task.organization_id == org).group_by(Task.status)).all())
    today = date.today()
    overdue = _count(db, select(func.count()).select_from(Task).where(
        Task.organization_id == org, Task.status != "done", Task.due_date < today))

    # Throughput: tasks moved to done per day for the last 14 days (from recorded task events).
    since = datetime.now(UTC) - timedelta(days=13)
    done_events = db.scalars(select(TaskEvent.created_at).join(Task, Task.id == TaskEvent.task_id).where(
        Task.organization_id == org, TaskEvent.to_status == "done", TaskEvent.created_at >= since.replace(hour=0, minute=0))).all()
    created_events = db.scalars(select(TaskEvent.created_at).join(Task, Task.id == TaskEvent.task_id).where(
        Task.organization_id == org, TaskEvent.kind == "created", TaskEvent.created_at >= since.replace(hour=0, minute=0))).all()
    days = [(today - timedelta(days=i)) for i in range(13, -1, -1)]
    throughput = [{"day": d.isoformat(),
                   "completed": sum(1 for e in done_events if e.date() == d),
                   "created": sum(1 for e in created_events if e.date() == d)} for d in days]

    active = db.scalars(select(Project).where(Project.organization_id == org, Project.status == "active")
                        .order_by(Project.due_date.is_(None), Project.due_date)).all()
    counts = project_service.task_counts(db, [p.id for p in active])
    agents = db.scalars(select(Agent).where(Agent.organization_id == org).order_by(Agent.slug)).all()
    sites = db.scalars(select(Website).where(Website.organization_id == org)).all()
    checked = [w for w in sites if w.status != "unknown"]
    recent = db.scalars(select(AuditLog).where(AuditLog.organization_id == org, ~AuditLog.action.startswith("auth."))
                        .order_by(AuditLog.id.desc()).limit(12)).all()
    open_stages = ["new", "contacted", "qualified", "proposal"]
    leads_by_stage = dict(db.execute(select(Lead.stage, func.count()).where(Lead.organization_id == org).group_by(Lead.stage)).all())
    # Pipeline value is reported PER CURRENCY — amounts in different currencies are never added together.
    pipeline_value = {cur: str(quantize(total, cur)) for cur, total in db.execute(
        select(Lead.currency, func.sum(Lead.estimated_amount)).where(Lead.organization_id == org, Lead.stage.in_(open_stages))
        .group_by(Lead.currency)).all() if total is not None}
    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    billable = db.scalar(select(func.coalesce(func.sum(TimeEntry.minutes), 0)).where(
        TimeEntry.organization_id == org, TimeEntry.billable.is_(True), TimeEntry.started_at >= month_start)) or 0
    non_billable = db.scalar(select(func.coalesce(func.sum(TimeEntry.minutes), 0)).where(
        TimeEntry.organization_id == org, TimeEntry.billable.is_(False), TimeEntry.started_at >= month_start)) or 0
    retainers = [retainer_out(db, r) for r in db.scalars(select(Retainer).where(Retainer.organization_id == org, Retainer.status == "active"))]
    billing_by_status = dict(db.execute(select(BillingHandoff.status, func.count()).where(BillingHandoff.organization_id == org)
                                        .group_by(BillingHandoff.status)).all())
    return {
        "pipeline": {"by_stage": leads_by_stage, "open": sum(leads_by_stage.get(s_, 0) for s_ in open_stages),
                     "won": leads_by_stage.get("won", 0), "value_by_currency": pipeline_value},
        "time": {"month_start": month_start.date().isoformat(), "billable_minutes": int(billable),
                 "non_billable_minutes": int(non_billable)},
        "retainers": retainers,
        "billing": {"by_status": billing_by_status},
        "generated_at": datetime.now(UTC).isoformat(),
        "demo_data": _count(db, select(func.count()).select_from(Project).where(Project.organization_id == org, Project.is_demo)) > 0,
        "projects": {"by_status": proj_by_status, "active": proj_by_status.get("active", 0),
                     "completed": proj_by_status.get("completed", 0), "upcoming": proj_by_status.get("upcoming", 0),
                     "total": sum(proj_by_status.values())},
        "tasks": {"by_status": task_by_status, "open": sum(v for k, v in task_by_status.items() if k != "done"),
                  "overdue": overdue, "throughput_14d": throughput},
        "clients": {"active": _count(db, select(func.count()).select_from(Client).where(Client.organization_id == org, Client.status == "active")),
                    "total": _count(db, select(func.count()).select_from(Client).where(Client.organization_id == org))},
        "agents": {"total": len(agents), "enabled": sum(a.enabled for a in agents),
                   "emergency_stop": not s.agents_enabled,
                   "items": [{"id": a.slug, "display_name": a.display_name, "role": a.role, "provider": a.provider,
                              "status": "connected" if (a.enabled and s.agents_enabled) else "not_connected"} for a in agents],
                   "runs_blocked": _count(db, select(func.count()).select_from(AgentRun).where(AgentRun.organization_id == org, AgentRun.status == "blocked"))},
        "websites": {"total": len(sites), "checked": len(checked), "up": sum(w.status == "up" for w in checked),
                     "availability_pct": round(100 * sum(w.status == "up" for w in checked) / len(checked)) if checked else None},
        "approvals": {"pending": _count(db, select(func.count()).select_from(Approval).where(Approval.organization_id == org, Approval.status == "pending"))},
        "active_projects": [project_service.to_out(db, p, counts).model_dump(mode="json") for p in active[:6]],
        "activity": [{"id": a.id, "actor": a.actor_label, "action": a.action, "summary": a.summary,
                      "at": a.created_at.isoformat()} for a in recent],
        "safety": {"agents_enabled": s.agents_enabled, "repository_writes_enabled": s.repository_writes_enabled,
                   "production_deployment_enabled": s.production_deployment_enabled},
    }
