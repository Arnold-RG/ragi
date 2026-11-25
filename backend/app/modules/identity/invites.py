"""Hashed, email-bound, single-use invites (TTL 72 h). The raw token is shown once."""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.identity.models import AuthToken

INVITE_TTL = timedelta(hours=72)
INVITE_ROLES = {"viewer", "operator", "admin"}
GENERIC = "This invite can’t be used. Ask the owner for a new one."
INVITE_COOKIE = "__Host-ragi_invite"
INVITE_COOKIE_MAX_AGE = 10 * 60  # 10 minutes


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue(db: Session, *, email: str, role: str, created_by: str | None) -> str:
    if role not in INVITE_ROLES:
        raise ValueError("Invites can only grant viewer, operator or admin")
    raw = secrets.token_urlsafe(32)
    db.add(AuthToken(
        kind="invite",
        token_hash=_hash(raw),
        email=email.strip().lower(),
        role=role,
        created_by=created_by,
        expires_at=datetime.now(UTC) + INVITE_TTL,
    ))
    db.flush()
    return raw


def lookup(db: Session, token: str | None) -> AuthToken | None:
    if not token:
        return None
    row = db.scalar(select(AuthToken).where(AuthToken.token_hash == _hash(token), AuthToken.kind == "invite"))
    return row


def is_usable(row: AuthToken | None) -> bool:
    if row is None:
        return False
    now = datetime.now(UTC)
    exp = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=UTC)
    return row.revoked_at is None and row.used_at is None and exp > now


def consume(db: Session, token: str, email: str) -> AuthToken:
    """Mark a valid invite used. Raises ValueError(GENERIC) for every failure mode."""
    row = lookup(db, token)
    if not is_usable(row) or (row.email or "") != email.strip().lower():
        if row and is_usable(row) is False and row.expires_at:
            # still a generic error; optionally stamp expired_use in the caller
            pass
        raise ValueError(GENERIC)
    row.used_at = datetime.now(UTC)
    db.flush()
    return row


def preview(row: AuthToken) -> dict:
    return {
        "email": row.email,
        "role": row.role,
        "expires_at": row.expires_at.isoformat(),
        "ttl_hours": 72,
        "single_use": True,
    }
