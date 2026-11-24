from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.permissions import Perm
from app.database.session import get_db
from app.modules.agents.models import Agent
from app.modules.clients.models import Client
from app.modules.identity.deps import require
from app.modules.projects.models import Project
from app.modules.tasks.models import Task

router = APIRouter(tags=["search"])


@router.get("/search")
def search(q: str = Query(min_length=1, max_length=100), db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    like = f"%{q}%"
    org = user.organization_id
    out = []
    for p in db.scalars(select(Project).where(Project.organization_id == org, or_(Project.name.ilike(like), Project.summary.ilike(like))).limit(6)):
        out.append({"type": "project", "id": p.id, "title": p.name, "subtitle": p.status, "href": f"/projects/{p.id}"})
    for t in db.scalars(select(Task).where(Task.organization_id == org, Task.title.ilike(like)).limit(6)):
        out.append({"type": "task", "id": t.id, "title": t.title, "subtitle": t.status.replace("_", " "), "href": "/tasks"})
    for c in db.scalars(select(Client).where(Client.organization_id == org, or_(Client.name.ilike(like), Client.sector.ilike(like))).limit(6)):
        out.append({"type": "client", "id": c.id, "title": c.name, "subtitle": c.city or c.country, "href": "/clients"})
    for a in db.scalars(select(Agent).where(Agent.organization_id == org, or_(Agent.display_name.ilike(like), Agent.role.ilike(like))).limit(6)):
        out.append({"type": "agent", "id": a.slug, "title": a.display_name, "subtitle": a.role, "href": "/agents"})
    return {"query": q, "results": out}
