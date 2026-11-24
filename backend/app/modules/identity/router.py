from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import EncryptionUnavailable, encrypt
from app.core.security import new_totp_secret, totp_uri
from app.database.session import get_db
from app.modules.audit.service import record
from app.modules.identity import schemas
from app.modules.identity.deps import _check_csrf, current_user, get_any_session, get_enrolment_session
from app.modules.identity.models import User
from app.modules.identity.service import LoginError, MfaError, authenticate, check_mfa_code, revoke

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        s.session_cookie_name, token, max_age=s.session_ttl_hours * 3600,
        httponly=True, secure=s.cookie_secure, samesite="lax", path="/",
    )


@router.post("/login", response_model=schemas.LoginResponse)
def login(body: schemas.LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    _check_csrf(request)  # login CSRF: a cross-site form cannot set the custom header
    try:
        user, token, sess = authenticate(db, body.email, body.password, request)
    except LoginError as exc:
        raise HTTPException(exc.status, str(exc)) from exc
    _set_cookie(response, token)
    full = not sess.mfa_pending and not sess.enrolment_required
    return schemas.LoginResponse(mfa_required=sess.mfa_pending, mfa_enrolment_required=sess.enrolment_required,
                                 user=schemas.UserOut.model_validate(user) if full else None)


@router.post("/verify", response_model=schemas.LoginResponse)
def verify(body: schemas.VerifyRequest, request: Request, db: Session = Depends(get_db), found=Depends(get_any_session)):
    sess, user = found
    if not sess.mfa_pending:
        return schemas.LoginResponse(mfa_required=False, mfa_enrolment_required=sess.enrolment_required,
                                     user=None if sess.enrolment_required else schemas.UserOut.model_validate(user))
    try:
        check_mfa_code(db, sess, user, body.code, request)
    except MfaError as exc:
        db.commit()
        raise HTTPException(exc.status, str(exc)) from exc
    sess.mfa_pending = False
    user.last_login_at = datetime.now(UTC)
    record(db, user, "auth.login", "user", user.id, request=request, detail={"mfa": True})
    db.commit()
    return schemas.LoginResponse(mfa_required=False, user=schemas.UserOut.model_validate(user))


@router.post("/logout", status_code=204)
def logout(response: Response, db: Session = Depends(get_db), found=Depends(get_any_session)):
    sess, user = found
    record(db, user, "auth.logout", "user", user.id)
    revoke(db, sess)
    response.delete_cookie(get_settings().session_cookie_name, path="/")


@router.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.get("/session", response_model=schemas.SessionState)
def session_state(found=Depends(get_any_session)):
    sess, user = found
    return schemas.SessionState(mfa_pending=sess.mfa_pending, enrolment_required=sess.enrolment_required,
                                email=user.email, role=user.role)


@router.post("/mfa/setup", response_model=schemas.MfaSetupResponse)
def mfa_setup(db: Session = Depends(get_db), found=Depends(get_enrolment_session)):
    _, user = found
    if user.mfa_enabled:
        raise HTTPException(status.HTTP_409_CONFLICT, "MFA already enabled")
    secret = new_totp_secret()
    try:
        user.mfa_secret_enc = encrypt(secret)
    except EncryptionUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    db.commit()
    return schemas.MfaSetupResponse(secret=secret, otpauth_uri=totp_uri(secret, user.email))


@router.post("/mfa/enable", response_model=schemas.UserOut)
def mfa_enable(body: schemas.VerifyRequest, request: Request, db: Session = Depends(get_db),
               found=Depends(get_enrolment_session)):
    sess, user = found
    if user.mfa_enabled:
        raise HTTPException(status.HTTP_409_CONFLICT, "MFA already enabled")
    if not user.mfa_secret_enc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Start setup first")
    try:
        check_mfa_code(db, sess, user, body.code, request)
    except MfaError as exc:
        db.commit()
        raise HTTPException(exc.status if exc.status != 401 else 400, str(exc)) from exc
    user.mfa_enabled = True
    sess.enrolment_required = False
    record(db, user, "auth.mfa.enabled", "user", user.id, request=request)
    db.commit()
    return user


@router.post("/recovery", status_code=202)
def recovery(body: schemas.RecoveryRequest):
    """Account recovery needs an email provider, which is not connected yet.

    The endpoint always answers 202 so it never reveals whether an address exists.
    """
    return {"status": "accepted", "delivery": "not_configured"}


