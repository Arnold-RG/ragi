import time
from datetime import UTC, datetime, timedelta

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.client_ip import client_ip
from app.core.config import get_settings
from app.core.crypto import decrypt
from app.core.ratelimit import backoff_state, clear_backoff, hit, record_failure
from app.core.security import (
    burn_password_check, hash_password, hash_token, needs_rehash, new_session_token,
    totp_match_step, verify_password,
)
from app.modules.audit.service import record
from app.modules.identity.deps import aware
from app.modules.identity.models import User, UserSession


class LoginError(Exception):
    def __init__(self, message: str, status: int = 401, retry_after: int | None = None):
        super().__init__(message)
        self.status = status
        self.retry_after = retry_after


GENERIC_LOGIN = "Email or password is incorrect"
GENERIC_LOCK = "Too many attempts. Try again later."


def mfa_required_for(user: User) -> bool:
    return user.role in get_settings().mfa_required_roles


def _email_key(email: str) -> str:
    return email.strip().lower()


def start_session(db: Session, user: User, request: Request, *, method: str = "password") -> tuple[str, UserSession]:
    """Create a new session after a successful first factor (password or OAuth)."""
    settings = get_settings()
    now = datetime.now(UTC)
    pending = bool(user.mfa_enabled)
    enrol = (not user.mfa_enabled) and mfa_required_for(user)
    ttl_hours = settings.session_ttl_hours
    if pending or enrol:
        expires = now + timedelta(minutes=settings.mfa_pending_minutes)
    else:
        expires = now + timedelta(hours=ttl_hours)
    token = new_session_token()
    sess = UserSession(
        user_id=user.id,
        token_hash=hash_token(token),
        mfa_pending=pending,
        enrolment_required=enrol,
        expires_at=expires,
        user_agent=(request.headers.get("user-agent") or "")[:300],
        ip_address=client_ip(request),
        last_seen_at=now,
        reauth_at=None if pending else now,
    )
    db.add(sess)
    if not pending:
        user.last_login_at = now
    record(db, user, "auth.login.password_ok" if pending else "auth.login", "user", user.id,
           request=request, detail={"method": method, "mfa_pending": pending})
    db.flush()
    return token, sess


def rotate_session(db: Session, sess: UserSession, request: Request | None = None) -> tuple[str, UserSession]:
    """Revoke ``sess`` and issue a new token (MFA verify, enrolment, step-up)."""
    now = datetime.now(UTC)
    settings = get_settings()
    sess.revoked_at = now
    token = new_session_token()
    fresh = UserSession(
        user_id=sess.user_id,
        token_hash=hash_token(token),
        mfa_pending=False,
        enrolment_required=sess.enrolment_required,
        expires_at=now + timedelta(hours=settings.session_ttl_hours),
        user_agent=(request.headers.get("user-agent") if request else sess.user_agent) or sess.user_agent,
        ip_address=(client_ip(request) if request else sess.ip_address),
        last_seen_at=now,
        reauth_at=now,
    )
    db.add(fresh)
    db.flush()
    return token, fresh


def _rate_limits(db: Session, email: str, ip: str) -> None:
    allowed, retry = hit(db, f"login:ip:{ip}", 20, 300)
    if not allowed:
        raise LoginError(GENERIC_LOCK, 429, retry)
    allowed, retry = hit(db, f"login:acct-ip:{email}:{ip}", 10, 900)
    if not allowed:
        raise LoginError(GENERIC_LOCK, 429, retry)
    blocked, retry = backoff_state(db, f"login:email:{email}")
    if blocked:
        raise LoginError(GENERIC_LOCK, 429, retry)


def authenticate(db: Session, email: str, password: str, request: Request) -> tuple[User, str, UserSession]:
    settings = get_settings()
    ip = client_ip(request)
    key = _email_key(email)
    _rate_limits(db, key, ip)

    user = db.scalar(select(User).where(func.lower(User.email) == key))
    now = datetime.now(UTC)

    def fail(existing: User | None) -> None:
        # Same delay and same error whether or not the account exists.
        record_failure(db, f"login:email:{key}")
        if existing:
            existing.failed_logins += 1
            record(db, existing, "auth.login.failed", "user", existing.id, request=request)
        db.commit()
        # This attempt is always the generic 401. Backoff applies to the next request.
        raise LoginError(GENERIC_LOGIN)

    if not user:
        burn_password_check(password)
        fail(None)

    if not user.is_active or not verify_password(user.password_hash, password):
        if not user.is_active:
            burn_password_check(password)
        fail(user)

    user.failed_logins = 0
    user.locked_until = None
    clear_backoff(db, f"login:email:{key}")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    token, sess = start_session(db, user, request, method="password")
    db.commit()
    return user, token, sess


class MfaError(Exception):
    def __init__(self, message: str, status: int = 401, retry_after: int | None = None):
        super().__init__(message)
        self.status = status
        self.retry_after = retry_after


def check_mfa_code(db: Session, sess: UserSession, user: User, code: str, request: Request | None = None,
                   now: float | None = None) -> None:
    """Verify a TOTP code with attempt limits, lockout and replay protection.

    Caller commits. Raises MfaError on failure (state changes are kept)."""
    s = get_settings()
    now_dt = datetime.fromtimestamp(now, UTC) if now is not None else datetime.now(UTC)
    if user.mfa_locked_until and aware(user.mfa_locked_until) > now_dt:
        retry = int((aware(user.mfa_locked_until) - now_dt).total_seconds())
        raise MfaError("Too many wrong codes. Try again later.", 429, max(1, retry))
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
            raise MfaError("Too many wrong codes. Sign in again later.", 429, s.lockout_minutes * 60)
        raise MfaError("That code didn't match")
    user.mfa_last_step = step
    user.mfa_failures = 0
    user.mfa_locked_until = None


def revoke(db: Session, sess: UserSession) -> None:
    sess.revoked_at = datetime.now(UTC)
    db.commit()


def revoke_all_other(db: Session, user_id: str, keep: UserSession | None = None) -> int:
    now = datetime.now(UTC)
    rows = db.scalars(select(UserSession).where(UserSession.user_id == user_id,
                                                UserSession.revoked_at.is_(None))).all()
    n = 0
    for row in rows:
        if keep is not None and row.id == keep.id:
            continue
        row.revoked_at = now
        n += 1
    db.flush()
    return n
