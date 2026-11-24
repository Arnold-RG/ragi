from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditLog


def record(
    db: Session,
    actor: Any,
    action: str,
    subject_type: str | None = None,
    subject_id: str | None = None,
    *,
    summary: str | None = None,
    detail: dict | None = None,
    request: Request | None = None,
    organization_id: str | None = None,
) -> AuditLog:
    """Add an audit entry to the current transaction (caller commits)."""
    entry = AuditLog(
        organization_id=organization_id or getattr(actor, "organization_id", None),
        actor_id=getattr(actor, "id", None),
        actor_label=getattr(actor, "full_name", None) or (actor if isinstance(actor, str) else "system"),
        action=action,
        subject_type=subject_type,
        subject_id=subject_id,
        summary=summary,
        detail=detail,
        ip_address=request.client.host if request and request.client else None,
    )
    db.add(entry)
    return entry
