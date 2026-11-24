from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.core.money import quantize, parse_strict
from app.core.permissions import Perm
from app.modules.retainers.models import Retainer
from app.database.session import get_db
from app.events.outbox import publish
from app.modules.audit.service import record
from app.modules.clients.models import Client
from app.modules.identity.deps import require
from app.modules.projects import service
from app.modules.projects.models import Project, ProjectMilestone
from app.modules.projects.schemas import (MilestoneCreate, MilestoneOut, ProjectCreate, ProjectDetail, ProjectOut,
                                          ProjectUpdate)

router = APIRouter(prefix="/projects", tags=["projects"])


def _get(db: Session, user, project_id: str) -> Project:
    p = db.get(Project, project_id)
    if not p or p.organization_id != user.organization_id:
        p = db.scalar(select(Project).where(Project.organization_id == user.organization_id, Project.slug == project_id))
    if not p:
        raise not_found("Project")
    return p


def _check_client(db: Session, user, client_id: str | None) -> None:
    if client_id:
        c = db.get(Client, client_id)
        if not c or c.organization_id != user.organization_id:
            raise HTTPException(422, "Unknown client")


def _check_retainer(db: Session, user, retainer_id: str | None) -> None:
    if retainer_id:
        r = db.get(Retainer, retainer_id)
        if not r or r.organization_id != user.organization_id:
            raise HTTPException(422, "Unknown retainer")


@router.get("", response_model=list[ProjectOut])
def list_projects(
    status: str | None = Query(None, description="Comma-separated statuses"),
    q: str | None = None,
    client_id: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require(Perm.READ)),
):
    stmt = select(Project).where(Project.organization_id == user.organization_id)
    if status:
        stmt = stmt.where(Project.status.in_(status.split(",")))
    if client_id:
        stmt = stmt.where(Project.client_id == client_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Project.name.ilike(like), Project.summary.ilike(like)))
    projects = db.scalars(stmt.order_by(Project.updated_at.desc())).all()
    counts = service.task_counts(db, [p.id for p in projects])
    return [service.to_out(db, p, counts) for p in projects]


@router.post("", response_model=ProjectDetail, status_code=201)
def create_project(body: ProjectCreate, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.PROJECTS_WRITE))):
    _check_client(db, user, body.client_id)
    data = body.model_dump()
    slug = service.unique_slug(db, user.organization_id, data.pop("slug") or service.slugify(body.name))
    status = data.pop("status")
    data["production_url"] = str(data["production_url"]) if data["production_url"] else None
    _check_retainer(db, user, data.get("retainer_id"))
    if data.get("hourly_rate") is not None:
        data["hourly_rate"] = parse_strict(data["hourly_rate"], data["currency"])
    p = Project(organization_id=user.organization_id, slug=slug, status="upcoming",
                repo_provider="github" if data.get("repo_name") else None,
                integrations=service.DEFAULT_INTEGRATIONS, **data)
    db.add(p)
    db.flush()
    service.apply_status(db, p, status)
    publish(db, "project.created", {"project_id": p.slug, "name": p.name, "category": p.category, "status": p.status},
            project_id=p.slug)
    record(db, user, "project.created", "project", p.id, summary=f"Registered project {p.name}", request=request)
    db.commit()
    return service.to_out(db, p, detail=True)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: str, db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    return service.to_out(db, _get(db, user, project_id), detail=True)


@router.patch("/{project_id}", response_model=ProjectDetail)
def update_project(project_id: str, body: ProjectUpdate, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.PROJECTS_WRITE))):
    p = _get(db, user, project_id)
    changes = body.model_dump(exclude_unset=True)
    if "client_id" in changes:
        _check_client(db, user, changes["client_id"])
    new_status = changes.pop("status", None)
    if "production_url" in changes and changes["production_url"] is not None:
        changes["production_url"] = str(changes["production_url"])
    _check_retainer(db, user, changes.get("retainer_id"))
    for k, v in changes.items():
        setattr(p, k, v)
    if p.hourly_rate is not None:
        p.hourly_rate = parse_strict(p.hourly_rate, p.currency)
    if new_status:
        service.apply_status(db, p, new_status)
    record(db, user, "project.updated", "project", p.id, summary=f"Updated {p.name}",
           detail={"fields": sorted([*changes, *(["status"] if new_status else [])])}, request=request)
    db.commit()
    return service.to_out(db, p, detail=True)


@router.post("/{project_id}/milestones", response_model=MilestoneOut, status_code=201)
def add_milestone(project_id: str, body: MilestoneCreate, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.PROJECTS_WRITE))):
    p = _get(db, user, project_id)
    m = ProjectMilestone(project_id=p.id, **body.model_dump())
    db.add(m)
    record(db, user, "project.milestone.added", "project", p.id, summary=f"Milestone '{m.title}' on {p.name}", request=request)
    db.commit()
    return m


@router.post("/{project_id}/milestones/{milestone_id}/toggle", response_model=MilestoneOut)
def toggle_milestone(project_id: str, milestone_id: str, db: Session = Depends(get_db), user=Depends(require(Perm.PROJECTS_WRITE))):
    p = _get(db, user, project_id)
    m = db.get(ProjectMilestone, milestone_id)
    if not m or m.project_id != p.id:
        raise not_found("Milestone")
    m.done = not m.done
    record(db, user, "project.milestone.toggled", "project", p.id, summary=f"Milestone '{m.title}' {'done' if m.done else 'reopened'}")
    db.commit()
    return m
