from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.money import quantize, wire, parse_strict
from app.events.outbox import publish
from app.modules.billing.models import BillingHandoff
from app.modules.clients.models import Client
from app.modules.projects.models import Project
from app.modules.time_tracking.models import TimeEntry


def compute_lines(lines: list[dict], currency: str) -> tuple[list[dict], Decimal]:
    out, total = [], Decimal(0)
    for ln in lines:
        qty = Decimal(str(ln["quantity"]))
        unit = parse_strict(ln["unit_amount"], currency)
        amount = quantize(qty * unit, currency)
        total += amount
        out.append({"description": ln["description"], "quantity": str(qty), "unit_amount": str(unit),
                    "amount": str(amount), **({"time_entry_ids": ln["time_entry_ids"]} if ln.get("time_entry_ids") else {})})
    return out, quantize(total, currency)


def lines_from_time(db: Session, project: Project) -> tuple[list[dict], list[TimeEntry]]:
    if project.hourly_rate is None:
        raise ValueError("Set a draft hourly rate on the project first")
    entries = db.scalars(select(TimeEntry).where(TimeEntry.project_id == project.id, TimeEntry.billable.is_(True),
                                                 TimeEntry.billing_handoff_id.is_(None), TimeEntry.ended_at.is_not(None))).all()
    if not entries:
        raise ValueError("No unbilled billable time on this project")
    minutes = sum(e.minutes for e in entries)
    hours = (Decimal(minutes) / Decimal(60)).quantize(Decimal("0.01"))
    return [{"description": f"{project.name} — {hours} h billable time", "quantity": str(hours),
             "unit_amount": str(project.hourly_rate), "time_entry_ids": [e.id for e in entries]}], list(entries)


def hand_to_omh(db: Session, h: BillingHandoff) -> None:
    """Called only after the OWNER approves. Writes the event to the outbox."""
    client = db.get(Client, h.client_id)
    project = db.get(Project, h.project_id) if h.project_id else None
    ev = publish(db, "quotation.requested" if h.kind == "quote" else "invoice.requested", {
        "ragi_handoff_id": h.id,
        "client": {"ragi_client_id": client.id, "name": client.name, "email": client.email, "country": client.country},
        "title": h.title,
        "lines": [{**{k: v for k, v in ln.items() if k != "time_entry_ids"},
                   "unit_amount": wire(Decimal(ln["unit_amount"]), h.currency),
                   "amount": wire(Decimal(ln["amount"]), h.currency)} for ln in h.lines],
        "draft_total": wire(Decimal(h.draft_total), h.currency),
        "approved_by_owner": True,
    }, project_id=project.slug if project else None)
    h.status, h.outbox_event_id, h.handed_at = "handed_to_omh", ev.event_id, datetime.now(UTC)
