"""Upcoming work listed in RAGI without any money fields."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import Perm
from app.database.session import get_db
from app.modules.audit.service import record
from app.modules.future_projects.models import FutureProject
from app.modules.identity.deps import require

router = APIRouter(prefix="/future-projects", tags=["future-projects"])
STATUSES = {"planned", "in_progress", "done"}


class FutureIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    summary: str | None = Field(default=None, max_length=4000)
    status: str = "planned"
    target_date: date | None = None
    progress_pct: int = Field(default=0, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=4000)


class FutureUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    summary: str | None = None
    status: str | None = None
    target_date: date | None = None
    progress_pct: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = None


def _out(p: FutureProject) -> dict:
    return {"id": p.id, "name": p.name, "summary": p.summary, "status": p.status,
            "target_date": p.target_date.isoformat() if p.target_date else None,
            "progress_pct": p.progress_pct, "notes": p.notes,
            "open_in_money_hub": True}


@router.get("")
def list_future(db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    rows = db.scalars(select(FutureProject).where(FutureProject.organization_id == user.organization_id)
                      .order_by(FutureProject.target_date.is_(None), FutureProject.target_date)).all()
    return [_out(r) for r in rows]


@router.post("", status_code=201)
def create_future(body: FutureIn, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.PROJECTS_WRITE))):
    if body.status not in STATUSES:
        raise HTTPException(422, "Unknown status")
    p = FutureProject(organization_id=user.organization_id, **body.model_dump())
    db.add(p)
    db.flush()
    record(db, user, "future_project.created", "future_project", p.id, summary=f"Future project {p.name}", request=request)
    db.commit()
    return _out(p)


@router.patch("/{project_id}")
def update_future(project_id: str, body: FutureUpdate, request: Request, db: Session = Depends(get_db),
                  user=Depends(require(Perm.PROJECTS_WRITE))):
    p = db.get(FutureProject, project_id)
    if not p or p.organization_id != user.organization_id:
        raise HTTPException(404, "Future project not found")
    data = body.model_dump(exclude_unset=True)
    if data.get("status") and data["status"] not in STATUSES:
        raise HTTPException(422, "Unknown status")
    for k, v in data.items():
        setattr(p, k, v)
    record(db, user, "future_project.updated", "future_project", p.id, summary=p.name, request=request)
    db.commit()
    return _out(p)
