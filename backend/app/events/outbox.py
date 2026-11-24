import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.events.models import EventOutbox
from app.events.schemas import RAGI_PUBLISHES, EventEnvelope

ORG_SLUG = "arnovagroup"


def publish(db: Session, event_type: str, data: dict, project_id: str | None = None) -> EventOutbox:
    """Write an event to the outbox in the caller's transaction.

    Delivery happens later (workers/synchronization_worker.py), so a failed
    network call never loses or duplicates a business change.
    """
    if event_type not in RAGI_PUBLISHES:
        raise ValueError(f"RAGI does not publish {event_type}")
    env = EventEnvelope(
        event_id=f"ragi-{uuid.uuid4()}",
        event_type=event_type,
        source="ragi",
        organization_id=ORG_SLUG,
        project_id=project_id,
        occurred_at=datetime.now(UTC),
        data=data,
    )
    row = EventOutbox(event_id=env.event_id, event_type=event_type, payload=env.model_dump(mode="json"))
    db.add(row)
    return row
