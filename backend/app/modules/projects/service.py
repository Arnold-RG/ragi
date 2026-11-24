import re
from datetime import UTC, datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.events.outbox import publish
from app.modules.clients.models import Client
from app.modules.projects.models import Project, ProjectMilestone
from app.modules.projects.schemas import MilestoneOut, ProjectDetail, ProjectOut
from app.modules.tasks.models import Task

DEFAULT_INTEGRATIONS = {
    "ragi": {"enabled": False, "monitor_repository": True, "monitor_availability": True, "monitor_deployments": True},
    "omh": {"enabled": False, "track_revenue": True, "track_expenses": True, "track_subscriptions": True,
            "track_infrastructure": True},
}


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:80] or "project"


def unique_slug(db: Session, org_id: str, base: str) -> str:
    slug, n = base, 2
    while db.scalar(select(Project.id).where(Project.organization_id == org_id, Project.slug == slug)):
        slug, n = f"{base}-{n}", n + 1
    return slug


def task_counts(db: Session, project_ids: list[str]) -> dict[str, tuple[int, int]]:
    if not project_ids:
        return {}
    rows = db.execute(
        select(Task.project_id, func.count(), func.sum(case((Task.status == "done", 1), else_=0)))
        .where(Task.project_id.in_(project_ids))
        .group_by(Task.project_id)
    ).all()
    return {pid: (int(total), int(done or 0)) for pid, total, done in rows}


def to_out(db: Session, p: Project, counts: dict | None = None, detail: bool = False) -> ProjectOut:
    total, done = (counts or task_counts(db, [p.id])).get(p.id, (0, 0))
    if p.status == "completed":
        progress = 100
    elif total:
        progress = round(done * 100 / total)
    else:
        progress = 0
    client_name = db.scalar(select(Client.name).where(Client.id == p.client_id)) if p.client_id else None
    base = dict(task_total=total, task_done=done, progress=progress, client_name=client_name)
    if detail:
        ms = db.scalars(select(ProjectMilestone).where(ProjectMilestone.project_id == p.id).order_by(ProjectMilestone.due_date)).all()
        return ProjectDetail.model_validate(p).model_copy(
            update={**base, "milestones": [MilestoneOut.model_validate(m) for m in ms], "integrations": p.integrations or {}}
        )
    return ProjectOut.model_validate(p).model_copy(update=base)


def apply_status(db: Session, p: Project, new_status: str) -> None:
    if new_status == p.status:
        return
    p.status = new_status
    if new_status == "completed":
        p.completed_at = datetime.now(UTC)
        publish(db, "project.completed", {"project_id": p.slug, "name": p.name, "completed_at": p.completed_at.isoformat()},
                project_id=p.slug)
    else:
        p.completed_at = None
