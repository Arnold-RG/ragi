from datetime import datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.core.money import quantize
from app.core.permissions import Perm
from app.database.session import get_db
from app.modules.approvals.models import Approval
from app.modules.audit.service import record
from app.modules.billing import service
from app.modules.billing.models import BillingHandoff
from app.modules.clients.models import Client
from app.modules.identity.deps import require
from app.modules.projects.models import Project
from app.modules.time_tracking.models import TimeEntry

router = APIRouter(prefix="/billing-handoffs", tags=["billing"])
Currency = Literal["PLN", "RWF", "EUR", "USD", "GBP"]


class LineIn(BaseModel):
    description: str = Field(min_length=2, max_length=300)
    quantity: str = Field(pattern=r"^\d{1,6}(\.\d{1,2})?$")
    unit_amount: str = Field(pattern=r"^\d{1,15}(\.\d{1,2})?$")


class QuoteIn(BaseModel):
    client_id: str
    project_id: str | None = None
    title: str = Field(min_length=2, max_length=300)
    currency: Currency = "PLN"
    lines: list[LineIn] = Field(min_length=1, max_length=50)
    notes: str | None = Field(default=None, max_length=4000)


class FromTimeIn(BaseModel):
    project_id: str
    title: str | None = None


def out(db: Session, h: BillingHandoff) -> dict:
    return {"id": h.id, "kind": h.kind, "client_id": h.client_id,
            "client_name": db.scalar(select(Client.name).where(Client.id == h.client_id)),
            "project_id": h.project_id,
            "project_name": db.scalar(select(Project.name).where(Project.id == h.project_id)) if h.project_id else None,
            "title": h.title, "currency": h.currency, "lines": h.lines,
            "draft_total": str(quantize(Decimal(h.draft_total), h.currency)), "status": h.status,
            "approval_id": h.approval_id, "outbox_event_id": h.outbox_event_id, "omh_reference": h.omh_reference,
            "notes": h.notes, "is_demo": h.is_demo, "created_at": h.created_at.isoformat(),
            "handed_at": h.handed_at.isoformat() if h.handed_at else None}


def _get(db, user, hid) -> BillingHandoff:
    h = db.get(BillingHandoff, hid)
    if not h or h.organization_id != user.organization_id:
        raise not_found("Billing request")
    return h


@router.get("")
def list_handoffs(db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    return [out(db, h) for h in db.scalars(select(BillingHandoff).where(BillingHandoff.organization_id == user.organization_id)
                                           .order_by(BillingHandoff.created_at.desc())).all()]


@router.post("/quotes", status_code=201)
def create_quote(body: QuoteIn, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.CLIENTS_WRITE))):
    c = db.get(Client, body.client_id)
    if not c or c.organization_id != user.organization_id:
        raise HTTPException(422, "Unknown client")
    lines, total = service.compute_lines([ln.model_dump() for ln in body.lines], body.currency)
    h = BillingHandoff(organization_id=user.organization_id, kind="quote", client_id=c.id, project_id=body.project_id,
                       title=body.title, currency=body.currency, lines=lines, draft_total=total, notes=body.notes,
                       is_demo=c.is_demo)
    db.add(h)
    db.flush()
    record(db, user, "billing.quote.drafted", "billing_handoff", h.id, summary=f"Drafted quote “{h.title}”", request=request)
    db.commit()
    return out(db, h)


@router.post("/invoices/from-time", status_code=201)
def invoice_from_time(body: FromTimeIn, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.CLIENTS_WRITE))):
    p = db.get(Project, body.project_id)
    if not p or p.organization_id != user.organization_id:
        raise HTTPException(422, "Unknown project")
    if not p.client_id:
        raise HTTPException(422, "Project has no client")
    try:
        raw, entries = service.lines_from_time(db, p)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    lines, total = service.compute_lines(raw, p.currency)
    h = BillingHandoff(organization_id=user.organization_id, kind="invoice", client_id=p.client_id, project_id=p.id,
                       title=body.title or f"{p.name} — time", currency=p.currency, lines=lines, draft_total=total,
                       is_demo=p.is_demo)
    db.add(h)
    db.flush()
    # Reserve the time entries so they can never be billed twice.
    db.execute(update(TimeEntry).where(TimeEntry.id.in_([e.id for e in entries])).values(billing_handoff_id=h.id))
    record(db, user, "billing.invoice.drafted", "billing_handoff", h.id, summary=f"Drafted invoice request “{h.title}”", request=request)
    db.commit()
    return out(db, h)


@router.post("/{handoff_id}/submit")
def submit(handoff_id: str, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.CLIENTS_WRITE))):
    """Ask the owner to approve handing this request to OMH."""
    h = _get(db, user, handoff_id)
    if h.status != "draft":
        raise HTTPException(409, f"Request is {h.status}")
    a = Approval(organization_id=user.organization_id, kind="billing_handoff",
                 title=f"Send {h.kind} request “{h.title}” to Our Money Hub",
                 detail="Amounts and the official document live in Our Money Hub. Approve here to hand the request over.",
                 subject_type="billing_handoff", subject_id=h.id, requested_by=user.full_name, is_demo=h.is_demo)
    db.add(a)
    db.flush()
    h.status, h.approval_id = "pending_approval", a.id
    record(db, user, "billing.submitted", "billing_handoff", h.id, summary=f"Sent “{h.title}” for owner approval", request=request)
    db.commit()
    return out(db, h)


def on_approval(db: Session, handoff_id: str, approved: bool) -> None:
    h = db.get(BillingHandoff, handoff_id)
    if not h or h.status != "pending_approval":
        return
    if approved:
        service.hand_to_omh(db, h)
    else:
        h.status = "rejected"
        db.execute(update(TimeEntry).where(TimeEntry.billing_handoff_id == h.id).values(billing_handoff_id=None))


_ = datetime  # keep import for type hints in future revisions
