"""Versioned event envelope (master spec §10). Mirrors
ecosystem-contracts/schemas/event.schema.json."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

RAGI_PUBLISHES = {
    "project.created",
    "project.completed",
    "agent.registered",
    "agent.run.completed",
    "agent.usage.recorded",
    "security.incident.created",
    # PROPOSED v0 — not in master spec §10; awaiting OMH confirmation (spec gap #12)
    "quotation.requested",
    "invoice.requested",
}
RAGI_ACCEPTS = {
    "budget.updated",
    "budget.exceeded",
    "invoice.paid",
    # PROPOSED v0 — OMH reports the official document back (spec gap #12)
    "quotation.issued",
    "invoice.issued",
    "subscription.updated",
    "deployment.completed",
    "website.health.changed",
}


class EventEnvelope(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    event_id: str = Field(min_length=8, max_length=64)
    event_type: str = Field(pattern=r"^[a-z]+(\.[a-z_]+)+$")
    source: Literal["ragi", "omh", "github", "monitoring", "arnovagroup", "movies"]
    organization_id: str
    project_id: str | None = None
    occurred_at: datetime
    data: dict[str, Any]
