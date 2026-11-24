from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.core.permissions import Perm
from app.database.session import get_db
from app.integrations.monitoring.http_check import UnsafeTarget, check
from app.modules.audit.service import record
from app.modules.identity.deps import require
from app.modules.projects.models import Project
from app.modules.websites.models import Website, WebsiteHealthCheck

router = APIRouter(prefix="/websites", tags=["websites"])


class WebsiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str | None
    label: str
    url: str
    status: str
    last_status_code: int | None
    last_response_ms: int | None
    last_checked_at: datetime | None
    is_demo: bool


class WebsiteCreate(BaseModel):
    label: str = Field(min_length=2, max_length=200)
    url: HttpUrl
    project_id: str | None = None


@router.get("", response_model=list[WebsiteOut])
def list_websites(db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    return db.scalars(select(Website).where(Website.organization_id == user.organization_id).order_by(Website.label)).all()


@router.post("", response_model=WebsiteOut, status_code=201)
def add_website(body: WebsiteCreate, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.PROJECTS_WRITE))):
    if body.project_id:
        p = db.get(Project, body.project_id)
        if not p or p.organization_id != user.organization_id:
            raise HTTPException(422, "Unknown project")
    w = Website(organization_id=user.organization_id, label=body.label, url=str(body.url), project_id=body.project_id)
    db.add(w)
    db.flush()
    record(db, user, "website.registered", "website", w.id, summary=f"Registered {w.label}", request=request)
    db.commit()
    return w


@router.post("/{website_id}/check", response_model=WebsiteOut)
def run_check(website_id: str, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.WEBSITES_CHECK))):
    w = db.get(Website, website_id)
    if not w or w.organization_id != user.organization_id:
        raise not_found("Website")
    try:
        res = check(w.url)
    except UnsafeTarget as exc:
        raise HTTPException(422, str(exc)) from exc
    previous = w.status
    w.status, w.last_status_code, w.last_response_ms = res.status, res.status_code, res.response_ms
    w.last_checked_at = datetime.now(UTC)
    db.add(WebsiteHealthCheck(website_id=w.id, status=res.status, status_code=res.status_code,
                              response_ms=res.response_ms, error=res.error))
    record(db, user, "website.checked", "website", w.id,
           summary=f"{w.label}: {res.status}" + (f" ({res.response_ms} ms)" if res.response_ms else ""),
           detail={"previous": previous, "status": res.status, "code": res.status_code}, request=request)
    db.commit()
    return w
