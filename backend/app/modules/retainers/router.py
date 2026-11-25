from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import Perm
from app.database.session import get_db
from app.modules.audit.service import record
from app.modules.clients.models import Client
from app.modules.identity.deps import require
from app.modules.projects.models import Project
from app.modules.retainers.models import Retainer
from app.modules.time_tracking.models import TimeEntry

router = APIRouter(prefix="/retainers", tags=["retainers"])
WARN_AT = 0.8


class RetainerIn(BaseModel):
    client_id: str
    name: str = Field(min_length=2, max_length=200)
    hours_per_month: int = Field(gt=0, le=744)
    starts_on: date


def usage_minutes(db: Session, r: Retainer, month_start: datetime) -> int:
    return int(db.scalar(
        select(func.coalesce(func.sum(TimeEntry.minutes), 0)).join(Project, Project.id == TimeEntry.project_id)
        .where(Project.retainer_id == r.id, TimeEntry.billable.is_(True), TimeEntry.started_at >= month_start,
               TimeEntry.ended_at.is_not(None))) or 0)


def _out(db: Session, r: Retainer) -> dict:
    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    used = usage_minutes(db, r, month_start)
    included = r.hours_per_month * 60
    ratio = used / included if included else 0
    state = "over" if ratio > 1 else "warning" if ratio >= WARN_AT else "ok"
    return {"id": r.id, "client_id": r.client_id,
            "client_name": db.scalar(select(Client.name).where(Client.id == r.client_id)),
            "name": r.name, "hours_per_month": r.hours_per_month,
            "starts_on": r.starts_on.isoformat(), "status": r.status, "is_demo": r.is_demo,
            "month_start": month_start.date().isoformat(), "used_minutes": used, "included_minutes": included,
            "used_pct": round(ratio * 100), "usage_state": state,
            "projects": [{"id": p.id, "name": p.name} for p in db.scalars(select(Project).where(Project.retainer_id == r.id))]}


@router.get("")
def list_retainers(db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    return [_out(db, r) for r in db.scalars(select(Retainer).where(Retainer.organization_id == user.organization_id)
                                            .order_by(Retainer.name)).all()]


@router.post("", status_code=201)
def create_retainer(body: RetainerIn, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.CLIENTS_WRITE))):
    c = db.get(Client, body.client_id)
    if not c or c.organization_id != user.organization_id:
        raise HTTPException(422, "Unknown client")
    data = body.model_dump()
    r = Retainer(organization_id=user.organization_id, **data)
    db.add(r)
    db.flush()
    record(db, user, "retainer.created", "retainer", r.id, summary=f"Retainer {r.name} for {c.name}", request=request)
    db.commit()
    return _out(db, r)
