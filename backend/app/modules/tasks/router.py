from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.core.permissions import Perm
from app.database.session import get_db
from app.modules.agents.models import Agent
from app.modules.audit.service import record
from app.modules.identity.deps import require
from app.modules.projects.models import Project
from app.modules.tasks.models import Task, TaskEvent
from app.modules.tasks.schemas import TaskCreate, TaskEventOut, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _out(db: Session, t: Task) -> TaskOut:
    name = db.scalar(select(Project.name).where(Project.id == t.project_id)) if t.project_id else None
    agent = db.scalar(select(Agent.display_name).where(Agent.id == t.assignee_agent_id)) if t.assignee_agent_id else None
    return TaskOut.model_validate(t).model_copy(update={"project_name": name, "assignee_agent_name": agent})


def _validate_refs(db: Session, user, project_id: str | None, agent_id: str | None) -> None:
    if project_id:
        p = db.get(Project, project_id)
        if not p or p.organization_id != user.organization_id:
            raise HTTPException(422, "Unknown project")
    if agent_id:
        a = db.get(Agent, agent_id)
        if not a or a.organization_id != user.organization_id:
            raise HTTPException(422, "Unknown agent")


def _get(db: Session, user, task_id: str) -> Task:
    t = db.get(Task, task_id)
    if not t or t.organization_id != user.organization_id:
        raise not_found("Task")
    return t


@router.get("", response_model=list[TaskOut])
def list_tasks(project_id: str | None = None, status: str | None = None, q: str | None = None,
               db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    stmt = select(Task).where(Task.organization_id == user.organization_id)
    if project_id:
        stmt = stmt.where(Task.project_id == project_id)
    if status:
        stmt = stmt.where(Task.status.in_(status.split(",")))
    if q:
        stmt = stmt.where(or_(Task.title.ilike(f"%{q}%"), Task.description.ilike(f"%{q}%")))
    return [_out(db, t) for t in db.scalars(stmt.order_by(Task.position, Task.created_at)).all()]


@router.post("", response_model=TaskOut, status_code=201)
def create_task(body: TaskCreate, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.TASKS_WRITE))):
    _validate_refs(db, user, body.project_id, body.assignee_agent_id)
    t = Task(organization_id=user.organization_id, **body.model_dump())
    if t.status == "done":
        t.completed_at = datetime.now(UTC)
    db.add(t)
    db.flush()
    db.add(TaskEvent(task_id=t.id, kind="created", to_status=t.status, actor_label=user.full_name))
    record(db, user, "task.created", "task", t.id, summary=f"Created task “{t.title}”", request=request)
    db.commit()
    return _out(db, t)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: str, body: TaskUpdate, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.TASKS_WRITE))):
    t = _get(db, user, task_id)
    changes = body.model_dump(exclude_unset=True)
    _validate_refs(db, user, changes.get("project_id"), changes.get("assignee_agent_id"))
    old_status = t.status
    for k, v in changes.items():
        setattr(t, k, v)
    if "status" in changes and changes["status"] != old_status:
        t.completed_at = datetime.now(UTC) if t.status == "done" else None
        db.add(TaskEvent(task_id=t.id, kind="status", from_status=old_status, to_status=t.status, actor_label=user.full_name))
        record(db, user, "task.status", "task", t.id, summary=f"“{t.title}” → {t.status.replace('_', ' ')}",
               detail={"from": old_status, "to": t.status}, request=request)
    else:
        record(db, user, "task.updated", "task", t.id, summary=f"Updated task “{t.title}”", detail={"fields": sorted(changes)}, request=request)
    db.commit()
    return _out(db, t)


@router.get("/{task_id}/events", response_model=list[TaskEventOut])
def task_events(task_id: str, db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    t = _get(db, user, task_id)
    return db.scalars(select(TaskEvent).where(TaskEvent.task_id == t.id).order_by(TaskEvent.id)).all()
