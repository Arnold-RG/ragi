from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.core.permissions import Perm
from app.database.session import get_db
from app.modules.audit.service import record
from app.modules.identity.deps import require
from app.modules.projects.models import Project
from app.modules.tasks.models import Task
from app.modules.time_tracking.models import TimeEntry

router = APIRouter(prefix="/time-entries", tags=["time"])


class TimeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    project_name: str | None = None
    task_id: str | None
    task_title: str | None = None
    note: str | None
    started_at: datetime
    ended_at: datetime | None
    minutes: int
    billable: bool
    billed: bool = False
    running: bool = False
    is_demo: bool


class StartIn(BaseModel):
    project_id: str | None = None
    task_id: str | None = None
    note: str | None = Field(default=None, max_length=500)
    billable: bool = True


class ManualIn(BaseModel):
    project_id: str
    task_id: str | None = None
    minutes: int = Field(gt=0, le=24 * 60)
    date: datetime | None = None
    note: str | None = Field(default=None, max_length=500)
    billable: bool = True


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _out(db: Session, e: TimeEntry) -> TimeOut:
    return TimeOut.model_validate(e).model_copy(update={
        "project_name": db.scalar(select(Project.name).where(Project.id == e.project_id)),
        "task_title": db.scalar(select(Task.title).where(Task.id == e.task_id)) if e.task_id else None,
        "billed": e.billing_handoff_id is not None,
        "running": e.ended_at is None,
    })


def _resolve(db, user, project_id, task_id) -> tuple[str, str | None]:
    if task_id:
        t = db.get(Task, task_id)
        if not t or t.organization_id != user.organization_id:
            raise HTTPException(422, "Unknown task")
        if not t.project_id:
            raise HTTPException(422, "Task has no project; time must belong to a project")
        project_id = t.project_id
    p = db.get(Project, project_id) if project_id else None
    if not p or p.organization_id != user.organization_id:
        raise HTTPException(422, "Unknown project")
    return p.id, task_id


@router.get("", response_model=list[TimeOut])
def list_entries(project_id: str | None = None, days: int = 30, db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    q = select(TimeEntry).where(TimeEntry.organization_id == user.organization_id,
                                TimeEntry.started_at >= datetime.now(UTC) - timedelta(days=days))
    if project_id:
        q = q.where(TimeEntry.project_id == project_id)
    return [_out(db, e) for e in db.scalars(q.order_by(TimeEntry.started_at.desc()).limit(300)).all()]


@router.get("/running", response_model=TimeOut | None)
def running(db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    e = db.scalar(select(TimeEntry).where(TimeEntry.user_id == user.id, TimeEntry.ended_at.is_(None)))
    return _out(db, e) if e else None


@router.post("/start", response_model=TimeOut, status_code=201)
def start(body: StartIn, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.TASKS_WRITE))):
    if db.scalar(select(TimeEntry.id).where(TimeEntry.user_id == user.id, TimeEntry.ended_at.is_(None))):
        raise HTTPException(409, "A timer is already running — stop it first")
    pid, tid = _resolve(db, user, body.project_id, body.task_id)
    e = TimeEntry(organization_id=user.organization_id, user_id=user.id, project_id=pid, task_id=tid,
                  note=body.note, billable=body.billable, started_at=datetime.now(UTC))
    db.add(e)
    db.flush()
    record(db, user, "time.started", "time_entry", e.id, summary="Timer started", request=request)
    db.commit()
    return _out(db, e)


@router.post("/{entry_id}/stop", response_model=TimeOut)
def stop(entry_id: str, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.TASKS_WRITE))):
    e = db.get(TimeEntry, entry_id)
    if not e or e.user_id != user.id:
        raise not_found("Time entry")
    if e.ended_at is not None:
        raise HTTPException(409, "Timer already stopped")
    e.ended_at = datetime.now(UTC)
    e.minutes = max(1, round((e.ended_at - _aware(e.started_at)).total_seconds() / 60))
    record(db, user, "time.logged", "time_entry", e.id, summary=f"Logged {e.minutes} min", request=request)
    db.commit()
    return _out(db, e)


@router.post("", response_model=TimeOut, status_code=201)
def manual(body: ManualIn, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.TASKS_WRITE))):
    pid, tid = _resolve(db, user, body.project_id, body.task_id)
    start_at = _aware(body.date) if body.date else datetime.now(UTC) - timedelta(minutes=body.minutes)
    e = TimeEntry(organization_id=user.organization_id, user_id=user.id, project_id=pid, task_id=tid, note=body.note,
                  billable=body.billable, started_at=start_at, ended_at=start_at + timedelta(minutes=body.minutes),
                  minutes=body.minutes)
    db.add(e)
    db.flush()
    record(db, user, "time.logged", "time_entry", e.id, summary=f"Logged {e.minutes} min", request=request)
    db.commit()
    return _out(db, e)


@router.get("/summary")
def summary(db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    """Minutes this calendar month (UTC), per project, split billable / non-billable / unbilled."""
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    rows = db.execute(
        select(TimeEntry.project_id, TimeEntry.billable, TimeEntry.billing_handoff_id.is_(None), func.sum(TimeEntry.minutes))
        .where(TimeEntry.organization_id == user.organization_id, TimeEntry.started_at >= month_start,
               TimeEntry.ended_at.is_not(None))
        .group_by(TimeEntry.project_id, TimeEntry.billable, TimeEntry.billing_handoff_id.is_(None))).all()
    per: dict[str, dict] = {}
    for pid, billable, unbilled, mins in rows:
        d = per.setdefault(pid, {"project_id": pid, "billable": 0, "non_billable": 0, "unbilled_billable": 0})
        d["billable" if billable else "non_billable"] += int(mins or 0)
        if billable and unbilled:
            d["unbilled_billable"] += int(mins or 0)
    names = dict(db.execute(select(Project.id, Project.name).where(Project.id.in_(per.keys()))).all()) if per else {}
    for pid, d in per.items():
        d["project_name"] = names.get(pid)
    return {"month_start": month_start.isoformat(), "projects": sorted(per.values(), key=lambda d: -d["billable"]),
            "total_billable": sum(d["billable"] for d in per.values()),
            "total_non_billable": sum(d["non_billable"] for d in per.values())}
