"""Billing requests are handed to Our Money Hub. RAGI stores no amounts."""
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.events.outbox import publish
from app.modules.billing.models import BillingHandoff
from app.modules.projects.models import Project
from app.modules.time_tracking.models import TimeEntry


def clean_lines(lines: list[dict]) -> list[dict]:
    """Keep only non-money fields on a line (description, quantity, time entries)."""
    out = []
    for ln in lines:
        item = {"description": ln["description"]}
        if ln.get("quantity") is not None:
            item["quantity"] = str(ln["quantity"])
        if ln.get("time_entry_ids"):
            item["time_entry_ids"] = list(ln["time_entry_ids"])
        out.append(item)
    return out


def lines_from_time(db: Session, project: Project) -> tuple[list[dict], list[TimeEntry]]:
    entries = db.scalars(
        select(TimeEntry).where(
            TimeEntry.project_id == project.id, TimeEntry.billable.is_(True),
            TimeEntry.ended_at.is_not(None), TimeEntry.billing_handoff_id.is_(None),
        )
    ).all()
    if not entries:
        raise ValueError("No unbilled billable time on this project")
    minutes = sum(e.minutes or 0 for e in entries)
    hours = minutes / 60
    lines = [{"description": f"Time on {project.name}", "quantity": f"{hours:.2f}",
              "time_entry_ids": [e.id for e in entries]}]
    return lines, list(entries)


def to_out_lines(h: BillingHandoff) -> list[dict]:
    return clean_lines(h.lines or [])


def hand_to_omh(db: Session, h: BillingHandoff) -> None:
    """Mark the request as handed over. Money is created in Our Money Hub, not here."""
    ev = publish(db, "billing.handoff.ready", {
        "handoff_id": h.id, "kind": h.kind, "title": h.title,
        "client_id": h.client_id, "project_id": h.project_id,
        "notes": h.notes,
    })
    h.status = "handed_to_omh"
    h.handed_at = datetime.now(UTC)
    h.outbox_event_id = ev.id
