from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import Perm
from app.database.session import get_db
from app.modules.audit.models import AuditLog
from app.modules.identity.deps import require

router = APIRouter(prefix="/audit-logs", tags=["audit"])


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    actor_label: str
    action: str
    subject_type: str | None
    subject_id: str | None
    summary: str | None
    detail: dict | None
    created_at: datetime


@router.get("", response_model=list[AuditOut])
def list_audit(
    limit: int = Query(100, le=500),
    action: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require(Perm.AUDIT_READ)),
):
    q = select(AuditLog).where(AuditLog.organization_id == user.organization_id)
    if action:
        q = q.where(AuditLog.action.startswith(action))
    return db.scalars(q.order_by(AuditLog.id.desc()).limit(limit)).all()
