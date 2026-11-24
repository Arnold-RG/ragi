"""Request authentication and permission dependencies."""
from datetime import UTC, datetime

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import forbidden
from app.core.permissions import Perm, has_permission
from app.core.security import hash_token
from app.database.session import get_db
from app.modules.identity.models import User, UserSession

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_HEADER = "x-ragi-request"


def aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def load_session(db: Session, token: str | None) -> tuple[UserSession, User] | None:
    if not token:
        return None
    sess = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    if not sess or sess.revoked_at is not None or aware(sess.expires_at) <= datetime.now(UTC):
        return None
    user = db.get(User, sess.user_id)
    if not user or not user.is_active:
        return None
    return sess, user


def _check_csrf(request: Request) -> None:
    # Cookie-authenticated writes must carry a custom header that a cross-site
    # form cannot set; combined with SameSite=Lax cookies this blocks CSRF.
    if request.method not in SAFE_METHODS and request.headers.get(CSRF_HEADER) != "1":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing anti-CSRF header")


def get_any_session(request: Request, db: Session = Depends(get_db)) -> tuple[UserSession, User]:
    """Any live session, including MFA-pending and enrolment-only sessions."""
    _check_csrf(request)
    found = load_session(db, request.cookies.get(get_settings().session_cookie_name))
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


def require(perm: Perm):
    def _dep(user: User = Depends(current_user)) -> User:
        if not has_permission(user.role, perm):
            raise forbidden()
        return user

    return _dep
