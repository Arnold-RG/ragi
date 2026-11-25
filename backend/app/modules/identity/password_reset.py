"""Forgot-password paths: emailed 6-digit code, MFA recovery codes, or set after GitHub login."""
from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Request
from sqlalchemy.orm import Session

from app.core.client_ip import client_ip
from app.core.mailer import send_email
from app.core.passwords import hibp_pwned_count, validate_password
from app.core.ratelimit import hit
from app.core.recovery import consume_code
from app.core.security import hash_password
from app.modules.audit.service import record
from app.modules.identity.deps import aware
from app.modules.identity.models import PasswordResetCode, User
from app.modules.identity.service import _lookup_user, revoke_all_other

_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1, hash_len=32, salt_len=16)
GENERIC = {"status": "accepted", "message": "If an account exists for those details, we sent a reset code."}
RESET_MINUTES = 15


def _is_owner(user: User | None) -> bool:
    return bool(user and user.is_active and user.role == "owner")



class ResetError(Exception):
    def __init__(self, message: str, status: int = 400, retry_after: int | None = None):
        super().__init__(message)
        self.status = status
        self.retry_after = retry_after


def _rate(db: Session, request: Request, key: str) -> None:
    ip = client_ip(request)
    allowed, retry = hit(db, f"reset:ip:{ip}", 5, 3600)
    if not allowed:
        raise ResetError("Too many attempts. Try again later.", 429, retry)
    allowed, retry = hit(db, f"reset:id:{key}", 3, 3600)
    if not allowed:
        raise ResetError("Too many attempts. Try again later.", 429, retry)


def request_code(db: Session, identifier: str, request: Request) -> dict:
    key, user = _lookup_user(db, identifier)
    try:
        _rate(db, request, key or "empty")
    except ResetError as exc:
        # Same generic body even under lockout would leak; return 429 with generic message.
        raise ResetError("Too many attempts. Try again later.", 429, exc.retry_after) from exc
    if _is_owner(user):
        now = datetime.now(UTC)
        from sqlalchemy import select
        unused = db.scalars(select(PasswordResetCode).where(
            PasswordResetCode.user_id == user.id, PasswordResetCode.used_at.is_(None))).all()
        for row in unused:
            row.used_at = now
        code = f"{secrets.randbelow(1_000_000):06d}"
        db.add(PasswordResetCode(
            user_id=user.id,
            code_hash=_hasher.hash(code),
            expires_at=now + timedelta(minutes=RESET_MINUTES),
            created_ip=client_ip(request),
        ))
        send_email(
            to=user.email,
            subject="Your RAGI password reset code",
            text=(
                f"Your RAGI password reset code is {code}.\n\n"
                f"It expires in {RESET_MINUTES} minutes and can be used once.\n"
                "If you did not ask for this, you can ignore this email.\n"
            ),
            html=(
                f"<p>Your RAGI password reset code is <strong>{code}</strong>.</p>"
                f"<p>It expires in {RESET_MINUTES} minutes and can be used once.</p>"
                "<p>If you did not ask for this, you can ignore this email.</p>"
            ),
        )
        record(db, user, "auth.password.reset_requested", "user", user.id, request=request)
        db.commit()
    else:
        db.commit()
    return GENERIC


def _set_new_password(db: Session, user: User, password: str, request: Request, *, method: str) -> None:
    validate_password(password, email=user.email, name=user.full_name or user.username or "")
    _, breach = hibp_pwned_count(password)
    user.password_hash = hash_password(password)
    user.failed_logins = 0
    user.locked_until = None
    revoke_all_other(db, user.id, keep=None)
    from app.modules.identity.trusted_devices import revoke_all_for_user
    revoke_all_for_user(db, user.id)
    record(db, user, "auth.password.changed", "user", user.id, request=request,
           detail={"method": method, "breach_check": breach})
    db.commit()


def confirm_code(db: Session, identifier: str, code: str, password: str, request: Request) -> None:
    key, user = _lookup_user(db, identifier)
    _rate(db, request, key or "empty")
    raw = (code or "").strip()
    if len(raw) != 6 or not raw.isdigit():
        raise ResetError("That code didn't match or has expired")
    if not _is_owner(user):
        raise ResetError("That code didn't match or has expired")
    from sqlalchemy import select
    now = datetime.now(UTC)
    rows = db.scalars(select(PasswordResetCode).where(
        PasswordResetCode.user_id == user.id, PasswordResetCode.used_at.is_(None))).all()
    matched = None
    dummy = _hasher.hash("000000")
    for row in rows or [type("X", (), {"code_hash": dummy, "id": None, "expires_at": now})()]:
        try:
            ok = _hasher.verify(row.code_hash, raw)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            ok = False
        if ok and getattr(row, "id", None) and matched is None:
            if aware(getattr(row, "expires_at", now)) > now:
                matched = row
    if matched is None:
        db.commit()
        raise ResetError("That code didn't match or has expired")
    matched.used_at = now
    try:
        _set_new_password(db, user, password, request, method="email_code")
    except ValueError as exc:
        raise ResetError(str(exc), 422) from exc


def confirm_recovery(db: Session, identifier: str, recovery_code: str, password: str, request: Request) -> None:
    key, user = _lookup_user(db, identifier)
    _rate(db, request, key or "empty")
    if not _is_owner(user) or not consume_code(db, user.id, recovery_code):
        db.commit()
        raise ResetError("That recovery code didn't match")
    try:
        _set_new_password(db, user, password, request, method="recovery_code")
    except ValueError as exc:
        raise ResetError(str(exc), 422) from exc


def set_password(db: Session, user: User, password: str, request: Request) -> None:
    try:
        _set_new_password(db, user, password, request, method="authenticated")
    except ValueError as exc:
        raise ResetError(str(exc), 422) from exc
