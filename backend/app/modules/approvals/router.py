from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.core.permissions import Perm
from app.database.session import get_db
from app.modules.agents.service import resume_run_after_approval
from app.modules.approvals.models import Approval
from app.modules.audit.service import record
from app.modules.identity.deps import require

router = APIRouter(prefix="/approvals", tags=["approvals"])


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    kind: str
    title: str
    detail: str | None
    subject_type: str | None
    subject_id: str | None
    requested_by: str
    status: str
    decided_by: str | None
    decided_at: datetime | None
    decision_note: str | None
    is_demo: bool
    created_at: datetime


class Decision(BaseModel):
    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=2000)


@router.get("", response_model=list[ApprovalOut])
def list_approvals(status: str | None = None, db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    q = select(Approval).where(Approval.organization_id == user.organization_id)
    if status:
        q = q.where(Approval.status == status)
    return db.scalars(q.order_by(Approval.created_at.desc())).all()


@router.post("/{approval_id}/decide", response_model=ApprovalOut)
def decide(approval_id: str, body: Decision, request: Request, db: Session = Depends(get_db),
           user=Depends(require(Perm.APPROVALS_DECIDE))):
    a = db.get(Approval, approval_id, with_for_update=True)  # serialise concurrent decisions
    if not a or a.organization_id != user.organization_id:
        raise not_found("Approval")
    if a.status != "pending":
        raise HTTPException(409, "Already decided")
    a.status = body.decision
    a.decided_by = user.full_name
    a.decided_at = datetime.now(UTC)
    a.decision_note = body.note
    record(db, user, f"approval.{body.decision}", "approval", a.id, summary=f"{body.decision.title()}: {a.title}", request=request)
    if a.kind == "agent_run" and a.subject_id:
        resume_run_after_approval(db, a.subject_id, approved=body.decision == "approved")
    elif a.kind == "billing_handoff" and a.subject_id:
        from app.modules.billing.router import on_approval

        on_approval(db, a.subject_id, approved=body.decision == "approved")
    db.commit()
    return a
