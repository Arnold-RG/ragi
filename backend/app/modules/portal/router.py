"""Client portal API. A portal user (role=client) sees ONLY their own client's
projects, milestones and billing-request statuses — never internal tasks,
time entries, agents, audit logs or other clients."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.billing.models import BillingHandoff
from app.modules.clients.models import Client
from app.modules.identity.deps import current_user
from app.modules.identity.models import User
from app.modules.projects import service as project_service
from app.modules.projects.models import Project, ProjectMilestone

router = APIRouter(prefix="/portal", tags=["client portal"])


def portal_user(user: User = Depends(current_user)) -> User:
    if user.role != "client" or not user.client_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Client portal only")
    return user


@router.get("/overview")
def overview(db: Session = Depends(get_db), user: User = Depends(portal_user)):
    client = db.get(Client, user.client_id)
    projects = db.scalars(select(Project).where(Project.client_id == client.id).order_by(Project.due_date)).all()
    counts = project_service.task_counts(db, [p.id for p in projects])
    items = []
    for p in projects:
        o = project_service.to_out(db, p, counts)
        ms = db.scalars(select(ProjectMilestone).where(ProjectMilestone.project_id == p.id).order_by(ProjectMilestone.due_date)).all()
        items.append({"id": p.id, "name": p.name, "status": p.status, "progress": o.progress, "summary": p.summary,
                      "due_date": p.due_date.isoformat() if p.due_date else None, "is_demo": p.is_demo,
                      "milestones": [{"title": m.title, "due_date": m.due_date.isoformat() if m.due_date else None,
                                      "done": m.done} for m in ms]})
    billing = db.scalars(select(BillingHandoff).where(BillingHandoff.client_id == client.id,
                                                      BillingHandoff.status.in_(["issued", "paid"]))).all()
    return {"client": {"name": client.name, "is_demo": client.is_demo}, "projects": items,
            "documents": [{"kind": b.kind, "title": b.title, "status": b.status, "omh_reference": b.omh_reference}
                          for b in billing],
            "files": {"available": False, "detail": "File delivery needs S3-compatible storage (not connected)."},
            "support": {"available": False, "detail": "Support tickets are TBD (spec gap #20)."}}
