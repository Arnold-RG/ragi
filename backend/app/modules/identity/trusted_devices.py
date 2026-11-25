"""Owner trusted-device cookies: hashed DB rows, TOTP-only unlock, revocable in Settings."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.client_ip import client_ip
from app.core.config import get_settings
from app.core.crypto import decrypt
from app.core.security import hash_token, new_session_token, totp_match_step
from app.modules.audit.service import record
from app.modules.identity.cookies import (
    clear_trusted_cookie,
    read_trusted_token,
    set_trusted_cookie,
)
from app.modules.identity.models import TrustedDevice, User
from app.modules.identity.service import MfaError, aware


MAX_DEVICES = 15


def device_label(user_agent: str | None) -> str:
    ua = (user_agent or "").strip()
    if not ua:
        return "This device"
    low = ua.lower()
    os_name = (
        "iPhone" if "iphone" in low else
        "iPad" if "ipad" in low else
        "Android" if "android" in low else
        "macOS" if "mac os" in low or "macintosh" in low else
        "Windows" if "windows" in low else
        "Linux" if "linux" in low else
        "this device"
    )
    browser = (
        "Edge" if "edg/" in low else
        "Chrome" if "chrome" in low and "chromium" not in low else
        "Firefox" if "firefox" in low else
        "Safari" if "safari" in low else
        "Browser"
    )
    if os_name == "this device":
        return browser
    return f"{browser} on {os_name}"


def _days() -> int:
    return max(1, int(get_settings().trusted_device_days))


def _max_age() -> int:
    return _days() * 86400


def load_trusted(db: Session, token: str | None) -> TrustedDevice | None:
    if not token:
        return None
    row = db.scalar(select(TrustedDevice).where(TrustedDevice.token_hash == hash_token(token)))
    if not row or row.revoked_at is not None:
        return None
    if aware(row.expires_at) <= datetime.now(UTC):
        return None
    return row


def lookup_unlock(db: Session, request: Request) -> tuple[TrustedDevice, User] | None:
    row = load_trusted(db, read_trusted_token(request))
    if not row:
        return None
    user = db.get(User, row.user_id)
    if not user or not user.is_active or user.role != "owner" or not user.mfa_enabled:
        return None
    return row, user


def hint(db: Session, request: Request) -> dict:
    found = lookup_unlock(db, request)
    if not found:
        return {"available": False}
    _, user = found
    return {"available": True, "display_name": user.full_name}


def issue_or_refresh(db: Session, user: User, request: Request, response: Response) -> None:
    """Call after a full password + TOTP (or recovery) sign-in. Owner only."""
    if user.role != "owner" or not user.mfa_enabled:
        return
    now = datetime.now(UTC)
    existing = load_trusted(db, read_trusted_token(request))
    if existing and existing.user_id == user.id:
        existing.last_used_at = now
        existing.expires_at = now + timedelta(days=_days())
        existing.failures = 0
        existing.locked_until = None
        existing.user_agent = (request.headers.get("user-agent") or existing.user_agent or "")[:300]
        existing.ip_address = client_ip(request)
        existing.label = device_label(request.headers.get("user-agent"))
        set_trusted_cookie(response, read_trusted_token(request) or "", max_age=_max_age())
        return
    # Cap how many devices stay trusted; drop the oldest unused one.
    rows = list(db.scalars(select(TrustedDevice).where(
        TrustedDevice.user_id == user.id, TrustedDevice.revoked_at.is_(None),
    ).order_by(TrustedDevice.last_used_at.asc().nullsfirst(), TrustedDevice.created_at.asc())).all())
    if len(rows) >= MAX_DEVICES:
        oldest = rows[0]
        oldest.revoked_at = now
    token = new_session_token()
    db.add(TrustedDevice(
        user_id=user.id,
        token_hash=hash_token(token),
        label=device_label(request.headers.get("user-agent")),
        user_agent=(request.headers.get("user-agent") or "")[:300],
        ip_address=client_ip(request),
        created_at=now,
        last_used_at=now,
        expires_at=now + timedelta(days=_days()),
    ))
    db.flush()
    set_trusted_cookie(response, token, max_age=_max_age())


def unlock(db: Session, request: Request, response: Response, code: str) -> User:
    found = lookup_unlock(db, request)
    if not found:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in with your password")
    row, user = found
    now = datetime.now(UTC)
    settings = get_settings()
    if row.locked_until and aware(row.locked_until) > now:
        retry = int((aware(row.locked_until) - now).total_seconds())
        raise MfaError("Too many wrong codes. Try again later.", 429, max(1, retry))
    if user.mfa_locked_until and aware(user.mfa_locked_until) > now:
        retry = int((aware(user.mfa_locked_until) - now).total_seconds())
        raise MfaError("Too many wrong codes. Try again later.", 429, max(1, retry))
    secret = decrypt(user.mfa_secret_enc) if user.mfa_secret_enc else None
    step = totp_match_step(secret, code, now.timestamp()) if secret else None
    if step is None or (user.mfa_last_step is not None and step <= user.mfa_last_step):
        row.failures += 1
        user.mfa_failures += 1
        record(db, user, "auth.mfa.failed", "user", user.id, request=request,
               detail={"trusted_device": True, "replay": step is not None})
        if row.failures >= settings.max_mfa_failures or user.mfa_failures >= settings.max_mfa_failures:
            lock_for = timedelta(minutes=settings.lockout_minutes)
            row.failures = 0
            row.locked_until = now + lock_for
            user.mfa_failures = 0
            user.mfa_locked_until = now + lock_for
            record(db, user, "auth.mfa.locked", "user", user.id, request=request,
                   detail={"trusted_device": True})
            raise MfaError("Too many wrong codes. Try again later.", 429, settings.lockout_minutes * 60)
        raise MfaError("That code didn't match")
    user.mfa_last_step = step
    user.mfa_failures = 0
    user.mfa_locked_until = None
    row.failures = 0
    row.locked_until = None
    row.last_used_at = now
    row.expires_at = now + timedelta(days=_days())
    from app.modules.identity.models import UserSession
    from app.core.security import hash_token as _ht

    token = new_session_token()
    sess = UserSession(
        user_id=user.id,
        token_hash=_ht(token),
        mfa_pending=False,
        enrolment_required=False,
        expires_at=now + timedelta(hours=settings.session_ttl_hours),
        user_agent=(request.headers.get("user-agent") or "")[:300],
        ip_address=client_ip(request),
        last_seen_at=now,
        reauth_at=now,
    )
    db.add(sess)
    user.last_login_at = now
    record(db, user, "auth.login", "user", user.id, request=request,
           detail={"mfa": True, "trusted_device": True})
    db.flush()
    from app.modules.identity.cookies import set_session_cookie
    set_trusted_cookie(response, read_trusted_token(request) or "", max_age=_max_age())
    set_session_cookie(response, token, max_age=settings.session_ttl_hours * 3600)
    return user


def list_devices(db: Session, user: User, request: Request) -> list[dict]:
    rows = list(db.scalars(select(TrustedDevice).where(
        TrustedDevice.user_id == user.id, TrustedDevice.revoked_at.is_(None),
    ).order_by(TrustedDevice.last_used_at.desc().nullslast(), TrustedDevice.created_at.desc())).all())
    current = load_trusted(db, read_trusted_token(request))
    now = datetime.now(UTC)
    out = []
    for row in rows:
        if aware(row.expires_at) <= now:
            continue
        out.append({
            "id": row.id,
            "label": row.label,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "last_used_at": row.last_used_at.isoformat() if row.last_used_at else None,
            "expires_at": row.expires_at.isoformat() if row.expires_at else None,
            "current": bool(current and current.id == row.id),
        })
    return out


def revoke_one(db: Session, user: User, device_id: str, request: Request, response: Response) -> None:
    row = db.get(TrustedDevice, device_id)
    if not row or row.user_id != user.id or row.revoked_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    row.revoked_at = datetime.now(UTC)
    current = load_trusted(db, read_trusted_token(request))
    # load_trusted skips revoked, so compare id before/use token hash
    if read_trusted_token(request) and hash_token(read_trusted_token(request) or "") == row.token_hash:
        clear_trusted_cookie(response)
    record(db, user, "auth.trusted_device.revoked", "user", user.id, request=request,
           detail={"device_id": row.id})


def revoke_all(db: Session, user: User, request: Request, response: Response) -> int:
    now = datetime.now(UTC)
    n = 0
    for row in db.scalars(select(TrustedDevice).where(
        TrustedDevice.user_id == user.id, TrustedDevice.revoked_at.is_(None),
    )).all():
        row.revoked_at = now
        n += 1
    clear_trusted_cookie(response)
    record(db, user, "auth.trusted_device.revoked_all", "user", user.id, request=request,
           detail={"count": n})
    return n


def revoke_all_for_user(db: Session, user_id: str) -> int:
    now = datetime.now(UTC)
    n = 0
    for row in db.scalars(select(TrustedDevice).where(
        TrustedDevice.user_id == user_id, TrustedDevice.revoked_at.is_(None),
    )).all():
        row.revoked_at = now
        n += 1
    return n
