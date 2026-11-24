import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import Perm
from app.core.service_auth import AuthFailure, verify_request
from app.database.session import get_db
from app.events.models import EventInbox, EventOutbox
from app.events.schemas import RAGI_ACCEPTS, EventEnvelope
from app.modules.audit.service import record
from app.modules.identity.deps import require
from app.modules.identity.models import Organization

router = APIRouter(prefix="/events", tags=["events"])


def apply_inbound(db: Session, env: EventEnvelope) -> None:
    """Side effects of OMH events on RAGI records (RAGI never stores amounts as truth)."""
    from app.modules.billing.models import BillingHandoff

    hid = env.data.get("ragi_handoff_id")
    if env.event_type in {"quotation.issued", "invoice.issued", "invoice.paid"} and hid:
        h = db.get(BillingHandoff, hid)
        if h:
            h.status = "paid" if env.event_type == "invoice.paid" else "issued"
            h.omh_reference = str(env.data.get("omh_reference") or h.omh_reference or "")[:100] or None


class OutboxOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    event_id: str
    event_type: str
    status: str
    attempts: int
    created_at: datetime
    delivered_at: datetime | None
    payload: dict


@router.get("/outbox", response_model=list[OutboxOut])
def outbox(db: Session = Depends(get_db), _=Depends(require(Perm.EVENTS_READ))):
    return db.scalars(select(EventOutbox).order_by(EventOutbox.created_at.desc()).limit(200)).all()


@router.post("", status_code=202)
async def receive(request: Request, db: Session = Depends(get_db)):
    """Inbound events from OMH and other authenticated services.

    Service-to-service only: each service signs with its OWN rotating key
    (X-Arnova-Key-Id / X-Arnova-Timestamp / X-Arnova-Signature, scope "events:write").
    The envelope `source` must match the key's service. Requests older than the
    clock-skew window are rejected; duplicate event_ids are acknowledged and ignored.
    """
    body = await request.body()
    try:
        key = verify_request(request.headers, body, scope="events:write")
    except AuthFailure as exc:
        code = status.HTTP_503_SERVICE_UNAVAILABLE if "not configured" in str(exc) else status.HTTP_401_UNAUTHORIZED
        raise HTTPException(code, str(exc)) from exc
    try:
        env = EventEnvelope.model_validate(json.loads(body))
    except (ValidationError, ValueError) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid event envelope") from exc
    if env.source != key.service:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Event source does not match the signing service")
    if env.event_type not in RAGI_ACCEPTS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"RAGI does not accept {env.event_type}")
    if db.get(EventInbox, env.event_id):
        return {"status": "duplicate", "event_id": env.event_id}
    db.add(EventInbox(event_id=env.event_id, event_type=env.event_type, source=env.source, payload=env.model_dump(mode="json")))
    apply_inbound(db, env)
    org = db.scalar(select(Organization).where(Organization.slug == env.organization_id))
    if not org:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown organization")
    record(db, f"service:{env.source}", f"event.received.{env.event_type}", "event", env.event_id,
           summary=f"{env.source.upper()} sent {env.event_type}", organization_id=org.id)
    db.commit()
    return {"status": "accepted", "event_id": env.event_id}
