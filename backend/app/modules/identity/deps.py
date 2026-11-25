"""Request authentication and permission dependencies."""
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import forbidden
from app.core.permissions import Perm, has_permission
from app.core.security import hash_token
from app.database.session import get_db
from app.modules.identity.cookies import read_token
from app.modules.identity.models import User, UserSession

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_HEADER = "x-ragi-request"
OAUTH_EXEMPT_PREFIXES = ("/api/v1/auth/oauth/",)


def aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def public_origin() -> str:
    raw = (get_settings().public_base_url or "").rstrip("/")
    p = urlparse(raw)
    if p.scheme and p.netloc:
        return f"{p.scheme}://{p.netloc}"
    return raw


def allowed_origins() -> set[str]:
    s = get_settings()
    out = set()
    base = public_origin()
    if base:
        out.add(base)
    for raw in s.cors_origins or []:
        p = urlparse(raw)
        if p.scheme and p.netloc:
            out.add(f"{p.scheme}://{p.netloc}")
        elif raw:
            out.add(raw.rstrip("/"))
    return out


def request_origin(request: Request) -> str | None:
    origin = request.headers.get("origin")
    if origin:
        p = urlparse(origin)
        return f"{p.scheme}://{p.netloc}" if p.scheme and p.netloc else origin.rstrip("/")
    referer = request.headers.get("referer")
    if referer:
        p = urlparse(referer)
        if p.scheme and p.netloc:
            return f"{p.scheme}://{p.netloc}"
    return None


def load_session(db: Session, token: str | None) -> tuple[UserSession, User] | None:
    if not token:
        return None
    sess = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    now = datetime.now(UTC)
    if not sess or sess.revoked_at is not None or aware(sess.expires_at) <= now:
        return None
    user = db.get(User, sess.user_id)
    if not user or not user.is_active:
        return None
    settings = get_settings()
    last = aware(sess.last_seen_at) if sess.last_seen_at else aware(sess.created_at)
    idle_min = (settings.idle_timeout_minutes_privileged
                if user.role in settings.mfa_required_roles
                else settings.idle_timeout_minutes)
    if last and now - last > timedelta(minutes=idle_min):
        return None
    if not sess.last_seen_at or now - aware(sess.last_seen_at) >= timedelta(seconds=60):
        sess.last_seen_at = now
        db.flush()
    return sess, user


def _check_csrf(request: Request) -> None:
    # Cookie-authenticated writes must carry a custom header that a cross-site
    # form cannot set; combined with SameSite=Lax cookies this blocks CSRF.
    if request.method in SAFE_METHODS:
        return
    path = request.url.path
    if any(path.startswith(p) and path.rstrip("/").endswith("/callback") for p in OAUTH_EXEMPT_PREFIXES):
        return
    if request.headers.get(CSRF_HEADER) != "1":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing anti-CSRF header")
    origin = request_origin(request)
    if not origin or origin not in allowed_origins():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid request origin")


def get_any_session(request: Request, db: Session = Depends(get_db)) -> tuple[UserSession, User]:
    """Any live session, including MFA-pending and enrolment-only sessions."""
    _check_csrf(request)
    found = load_session(db, read_token(request))
    if not found:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return found


# Backwards-compatible name
get_pending_session = get_any_session


def get_enrolment_session(found=Depends(get_any_session)) -> tuple[UserSession, User]:
    """Password verified and not waiting for a code: full or enrolment-only session."""
    sess, _ = found
    if sess.mfa_pending:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Verification code required")
    return found


def current_user(request: Request, found=Depends(get_enrolment_session)) -> User:
    sess, user = found
    if sess.enrolment_required:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Set up two-factor authentication to continue")
    request.state.user = user
    return user


def require_recent_auth(max_age: int = 600):
    def _dep(found=Depends(get_enrolment_session)) -> tuple[UserSession, User]:
        sess, user = found
        if sess.enrolment_required:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Set up two-factor authentication to continue")
        if not sess.reauth_at or (datetime.now(UTC) - aware(sess.reauth_at)).total_seconds() > max_age:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Reauthentication required")
        return found
    return _dep


def require(perm: Perm):
    def _dep(user: User = Depends(current_user)) -> User:
        if not has_permission(user.role, perm):
            raise forbidden()
        return user

    return _dep
