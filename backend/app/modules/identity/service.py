import time
from datetime import UTC, datetime, timedelta

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import decrypt
from app.core.security import burn_password_check, hash_token, new_session_token, totp_match_step, verify_password
from app.modules.audit.service import record
from app.modules.identity.deps import aware
from app.modules.identity.models import User, UserSession


class LoginError(Exception):
    def __init__(self, message: str, status: int = 401):
        super().__init__(message)
        self.status = status


def mfa_required_for(user: User) -> bool:
    return user.role in get_settings().mfa_required_roles


def authenticate(db: Session, email: str, password: str, request: Request) -> tuple[User, str, UserSession]:
    settings = get_settings()
    user = db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))
    now = datetime.now(UTC)
    if not user:
        burn_password_check(password)
        raise LoginError("Email or password is incorrect")
    if user.locked_until and aware(user.locked_until) > now:
        record(db, user, "auth.login.locked", "user", user.id, request=request)
        db.commit()
        raise LoginError("Account temporarily locked after repeated failures. Try again later.", 429)
    if not user.is_active or not verify_password(user.password_hash, password):
        user.failed_logins += 1
        if user.failed_logins >= settings.max_failed_logins:
            user.locked_until = now + timedelta(minutes=settings.lockout_minutes)
            user.failed_logins = 0
        record(db, user, "auth.login.failed", "user", user.id, request=request)
        db.commit()
        raise LoginError("Email or password is incorrect")

    user.failed_logins = 0
    user.locked_until = None
    token = new_session_token()
    sess = UserSession(
        user_id=user.id,
        token_hash=hash_token(token),
        mfa_pending=user.mfa_enabled,
        enrolment_required=(not user.mfa_enabled) and mfa_required_for(user),
        expires_at=now + timedelta(hours=settings.session_ttl_hours),
        user_agent=(request.headers.get("user-agent") or "")[:300],
        ip_address=request.client.host if request.client else None,
    )
    db.add(sess)
    if not user.mfa_enabled:
        user.last_login_at = now
    record(db, user, "auth.login.password_ok" if user.mfa_enabled else "auth.login", "user", user.id, request=request)
    db.commit()
    return user, token, sess


class MfaError(Exception):
    def __init__(self, message: str, status: int = 401):
        super().__init__(message)
        self.status = status


def check_mfa_code(db: Session, sess: UserSession, user: User, code: str, request: Request | None = None,
                   now: float | None = None) -> None:
    """Verify a TOTP code with attempt limits, lockout and replay protection.

    Caller commits. Raises MfaError on failure (state changes are kept)."""
    s = get_settings()
    now_dt = datetime.fromtimestamp(now, UTC) if now is not None else datetime.now(UTC)
    if user.mfa_locked_until and aware(user.mfa_locked_until) > now_dt:
        raise MfaError("Too many wrong codes. Try again later.", 429)
    secret = decrypt(user.mfa_secret_enc) if user.mfa_secret_enc else None
    step = totp_match_step(secret, code, now if now is not None else time.time()) if secret else None
    if step is None or (user.mfa_last_step is not None and step <= user.mfa_last_step):
        user.mfa_failures += 1
        record(db, user, "auth.mfa.failed", "user", user.id, request=request,
               detail={"replay": step is not None})
        if user.mfa_failures >= s.max_mfa_failures:
            user.mfa_failures = 0
            user.mfa_locked_until = now_dt + timedelta(minutes=s.lockout_minutes)
            sess.revoked_at = now_dt  # force a fresh password sign-in
            record(db, user, "auth.mfa.locked", "user", user.id, request=request)
            raise MfaError("Too many wrong codes. Sign in again later.", 429)
        raise MfaError("That code didn't match")
    user.mfa_last_step = step
    user.mfa_failures = 0
    user.mfa_locked_until = None


def revoke(db: Session, sess: UserSession) -> None:
    sess.revoked_at = datetime.now(UTC)
    db.commit()
