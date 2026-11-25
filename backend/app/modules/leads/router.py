from datetime import datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.core.money import CURRENCIES, quantize, parse_strict
from app.core.permissions import Perm
from app.database.session import get_db
from app.events.outbox import publish
from app.modules.audit.service import record
from app.modules.clients.models import Client
from app.modules.identity.deps import require
from app.modules.leads.models import Lead
from app.modules.projects import service as project_service
from app.modules.projects.models import Project

router = APIRouter(prefix="/leads", tags=["pipeline"])
Stage = Literal["new", "contacted", "qualified", "proposal", "won", "lost"]
Currency = Literal["PLN", "RWF", "EUR", "USD", "GBP"]


class LeadIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    source: str | None = Field(default=None, max_length=60)
    service: str | None = Field(default=None, max_length=80)
    stage: Stage = "new"
    estimated_amount: str | None = Field(default=None, pattern=r"^\d{1,15}(\.\d{1,2})?$")
    currency: Currency = "PLN"
    notes: str | None = Field(default=None, max_length=4000)


class LeadUpdate(BaseModel):
    name: str | None = None
    company: str | None = None
    email: EmailStr | None = None
    service: str | None = None
    stage: Stage | None = None
    estimated_amount: str | None = Field(default=None, pattern=r"^\d{1,15}(\.\d{1,2})?$")
    currency: Currency | None = None
    notes: str | None = None
    lost_reason: str | None = Field(default=None, max_length=300)


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    company: str | None
    email: str | None
    source: str | None
    service: str | None
    stage: str
    estimated_amount: Decimal | None
    currency: str
    notes: str | None
    lost_reason: str | None
    client_id: str | None
    project_id: str | None
    is_demo: bool
    created_at: datetime
    updated_at: datetime

    @field_serializer("estimated_amount")
    def _amt(self, v: Decimal | None):
        return None if v is None else str(quantize(v, self.currency))


def _get(db, user, lead_id) -> Lead:
    lead = db.get(Lead, lead_id)
    if not lead or lead.organization_id != user.organization_id:
        raise not_found("Lead")
    return lead


@router.get("", response_model=list[LeadOut])
def list_leads(db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    return db.scalars(select(Lead).where(Lead.organization_id == user.organization_id).order_by(Lead.updated_at.desc())).all()


@router.post("", response_model=LeadOut, status_code=201)
def create_lead(body: LeadIn, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.CLIENTS_WRITE))):
    data = body.model_dump()
    if data["estimated_amount"] is not None:
        data["estimated_amount"] = parse_strict(data["estimated_amount"], body.currency)
    lead = Lead(organization_id=user.organization_id, **data)
    db.add(lead)
    db.flush()
    record(db, user, "lead.created", "lead", lead.id, summary=f"New lead: {lead.company or lead.name}", request=request)
    db.commit()
    return lead


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: str, body: LeadUpdate, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.CLIENTS_WRITE))):
    lead = _get(db, user, lead_id)
    changes = body.model_dump(exclude_unset=True)
    if changes.get("stage") == "won":
        raise HTTPException(422, "Use /convert to mark a lead as won")
    old = lead.stage
    for k, v in changes.items():
        setattr(lead, k, v)
    if lead.estimated_amount is not None:
        lead.estimated_amount = parse_strict(lead.estimated_amount, lead.currency)
    record(db, user, "lead.stage" if lead.stage != old else "lead.updated", "lead", lead.id,
           summary=f"{lead.company or lead.name}: {old} → {lead.stage}" if lead.stage != old else f"Updated lead {lead.name}",
           request=request)
    db.commit()
    return lead


class ConvertIn(BaseModel):
    project_name: str = Field(min_length=2, max_length=200)
    category: str = "client-website"


@router.post("/{lead_id}/convert", response_model=LeadOut)
def convert(lead_id: str, body: ConvertIn, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.CLIENTS_WRITE))):
    """Won lead → client + upcoming project (one transaction)."""
    lead = _get(db, user, lead_id)
    if lead.stage == "won":
        raise HTTPException(409, "Lead already converted")
    client = Client(organization_id=user.organization_id, name=lead.company or lead.name, contact_name=lead.name,
                    email=lead.email, status="active", is_demo=lead.is_demo)
    db.add(client)
    db.flush()
    slug = project_service.unique_slug(db, user.organization_id, project_service.slugify(body.project_name))
    p = Project(organization_id=user.organization_id, slug=slug, name=body.project_name, category=body.category,
                status="upcoming", client_id=client.id, is_demo=lead.is_demo, summary=lead.notes,
                integrations=project_service.DEFAULT_INTEGRATIONS)
    db.add(p)
    db.flush()
    publish(db, "project.created", {"project_id": p.slug, "name": p.name, "category": p.category, "status": p.status,
                                    "client": client.name}, project_id=p.slug)
    lead.stage, lead.client_id, lead.project_id = "won", client.id, p.id
    record(db, user, "lead.won", "lead", lead.id, summary=f"Won {client.name} → project {p.name}", request=request)
    db.commit()
    return lead


assert set(CURRENCIES) == {"PLN", "RWF", "EUR", "USD"}
