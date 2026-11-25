from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core import oauth_github, usernames
from app.modules.identity import password_reset as pwreset
from app.modules.identity.models import AuthIdentity, InstanceSetting, Organization, User
from app.core.crypto import EncryptionUnavailable, encrypt
from app.core.passwords import hibp_pwned_count, validate_password
from app.core.recovery import consume_code, issue_codes, remaining_count
from app.core.security import new_totp_secret, totp_uri
from app.database.session import get_db
from app.modules.audit.service import record
from app.modules.identity import invites, schemas
from app.modules.identity.cookies import clear_invite_cookie, clear_session_cookie, read_invite_token, set_invite_cookie, set_session_cookie
from app.modules.identity.deps import _check_csrf, current_user, get_any_session, get_enrolment_session, require_recent_auth
from app.modules.identity.service import (
    LoginError, MfaError, authenticate, check_mfa_code, revoke, revoke_all_other, rotate_session, start_session,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _cookie_age(sess) -> int:
    s = get_settings()
    if sess.mfa_pending or sess.enrolment_required:
        return s.mfa_pending_minutes * 60
    return s.session_ttl_hours * 3600


def _raise_login(exc: LoginError) -> None:
    headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
    raise HTTPException(exc.status, str(exc), headers=headers) from exc


@router.get("/config", response_model=schemas.AuthConfig)
def auth_config(db: Session = Depends(get_db)):
    s = get_settings()
    owner_setup = bool(s.ragi_owner_setup_token) and db.get(InstanceSetting, "owner_bootstrapped") is None
    return schemas.AuthConfig(
        registration_mode=s.registration_mode,
        owner_setup=owner_setup,
        providers={"github": bool(s.github_client_id)},
        password_reset="email",
        private=not s.is_development,
        signup_enabled=s.is_development and s.registration_mode == "open",
    )


@router.post("/login", response_model=schemas.LoginResponse)
def login(body: schemas.LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    _check_csrf(request)
    try:
        user, token, sess = authenticate(db, body.login_id(), body.password, request)
    except LoginError as exc:
        _raise_login(exc)
    set_session_cookie(response, token, max_age=_cookie_age(sess))
    full = not sess.mfa_pending and not sess.enrolment_required
    return schemas.LoginResponse(mfa_required=sess.mfa_pending, mfa_enrolment_required=sess.enrolment_required,
                                 user=schemas.UserOut.from_user(user) if full else None)


@router.post("/register", response_model=schemas.LoginResponse)
def register(body: schemas.RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Closed by default. The first owner is created with a one-time setup token."""
    _check_csrf(request)
    s = get_settings()
    token_ok = bool(s.ragi_owner_setup_token and body.setup_token
                    and _tokens_match(body.setup_token, s.ragi_owner_setup_token))
    bootstrapped = db.get(InstanceSetting, "owner_bootstrapped") is not None
    invite_raw = (body.invite_token or read_invite_token(request) or "").strip() or None
    setup_flow = token_ok and not bootstrapped
    invite_flow = (not setup_flow) and s.registration_mode == "invite" and bool(invite_raw)
    open_flow = (not setup_flow) and (not invite_flow) and s.registration_mode == "open"
    if not setup_flow and not s.is_development:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This app is private.")
    if not setup_flow and not invite_flow and not open_flow:
        if invite_raw:
            raise HTTPException(status.HTTP_403_FORBIDDEN, invites.GENERIC)
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Registration is closed. Ask the owner for an invite.")
    if setup_flow and len(s.ragi_owner_setup_token) < 32:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Owner setup is not configured correctly")
    try:
        username = usernames.validate_username(body.username)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    try:
        validate_password(body.password, email=body.email, name=body.full_name)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    _, breach = hibp_pwned_count(body.password)
    email = body.email.strip().lower()
    role = "owner" if setup_flow else "viewer"
    invite_row = None
    if invite_raw and s.registration_mode == "invite":
        try:
            invite_row = invites.consume(db, invite_raw, email)
        except ValueError as exc:
            raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
        role = invite_row.role or "viewer"
        invite_flow = True
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    if not usernames.is_available(db, User, username):
        raise HTTPException(status.HTTP_409_CONFLICT, "That username is not available")
    org = db.scalar(select(Organization).order_by(Organization.created_at))
    if org is None:
        org = Organization(slug="arnovagroup", name="Arnova Group")
        db.add(org)
        db.flush()
    from app.core.security import hash_password
    user = User(organization_id=org.id, email=email, username=username, full_name=body.full_name.strip(),
                role=role, password_hash=hash_password(body.password))
    db.add(user)
    if setup_flow:
        db.add(InstanceSetting(key="owner_bootstrapped", value="1"))
        try:
            db.flush()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "Owner setup has already been used") from exc
    else:
        db.flush()
    method = "setup" if setup_flow else ("invite" if invite_flow else "register")
    token, sess = start_session(db, user, request, method=method)
    record(db, user, "auth.signup.owner" if setup_flow else "auth.signup.created", "user", user.id,
           request=request, detail={"breach_check": breach, "method": method})
    if invite_flow:
        record(db, user, "auth.invite.accepted", "user", user.id, request=request,
               detail={"invite_id": invite_row.id, "role": role})
    codes = issue_codes(db, user.id)
    db.commit()
    set_session_cookie(response, token, max_age=_cookie_age(sess))
    if invite_flow:
        clear_invite_cookie(response)
    return schemas.LoginResponse(mfa_required=False, mfa_enrolment_required=sess.enrolment_required,
                                 recovery_codes=codes, user=None)


def _tokens_match(given: str, expected: str) -> bool:
    import hmac
    if not given or not expected:
        return False
    return hmac.compare_digest(given.encode(), expected.encode())


@router.post("/verify", response_model=schemas.LoginResponse)
def verify(body: schemas.VerifyRequest, request: Request, response: Response,
           db: Session = Depends(get_db), found=Depends(get_any_session)):
    sess, user = found
    if not sess.mfa_pending:
        return schemas.LoginResponse(mfa_required=False, mfa_enrolment_required=sess.enrolment_required,
                                     user=None if sess.enrolment_required else schemas.UserOut.from_user(user))
    try:
        check_mfa_code(db, sess, user, body.code, request)
    except MfaError as exc:
        db.commit()
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
        raise HTTPException(exc.status, str(exc), headers=headers) from exc
    sess.enrolment_required = False
    user.last_login_at = datetime.now(UTC)
    token, fresh = rotate_session(db, sess, request)
    record(db, user, "auth.login", "user", user.id, request=request, detail={"mfa": True})
    db.commit()
    set_session_cookie(response, token, max_age=_cookie_age(fresh))
    return schemas.LoginResponse(mfa_required=False, user=schemas.UserOut.from_user(user))


@router.post("/mfa/recovery", response_model=schemas.LoginResponse)
def verify_recovery(body: schemas.VerifyRequest, request: Request, response: Response,
                    db: Session = Depends(get_db), found=Depends(get_any_session)):
    sess, user = found
    if not sess.mfa_pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No verification is pending")
    if not consume_code(db, user.id, body.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "That backup code didn't match")
    user.last_login_at = datetime.now(UTC)
    token, fresh = rotate_session(db, sess, request)
    record(db, user, "auth.mfa.recovery_used", "user", user.id, request=request,
           detail={"remaining": remaining_count(db, user.id)})
    db.commit()
    set_session_cookie(response, token, max_age=_cookie_age(fresh))
    return schemas.LoginResponse(mfa_required=False, user=schemas.UserOut.from_user(user))


@router.post("/logout", status_code=204)
def logout(response: Response, db: Session = Depends(get_db), found=Depends(get_any_session)):
    sess, user = found
    record(db, user, "auth.logout", "user", user.id)
    revoke(db, sess)
    clear_session_cookie(response)


@router.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.get("/session", response_model=schemas.SessionState)
def session_state(db: Session = Depends(get_db), found=Depends(get_any_session)):
    sess, user = found
    return schemas.SessionState(mfa_pending=sess.mfa_pending, enrolment_required=sess.enrolment_required,
                                email=user.email, role=user.role,
                                recovery_remaining=remaining_count(db, user.id))


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


@router.post("/mfa/enable", response_model=schemas.LoginResponse)
def mfa_enable(body: schemas.VerifyRequest, request: Request, response: Response,
               db: Session = Depends(get_db), found=Depends(get_enrolment_session)):
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
    codes = issue_codes(db, user.id)
    token, fresh = rotate_session(db, sess, request)
    record(db, user, "auth.mfa.enabled", "user", user.id, request=request)
    db.commit()
    set_session_cookie(response, token, max_age=_cookie_age(fresh))
    return schemas.LoginResponse(mfa_required=False, recovery_codes=codes,
                                 user=schemas.UserOut.from_user(user))


@router.post("/oauth/github/start", response_model=schemas.OAuthStartResponse)
def oauth_github_start(request: Request, response: Response):
    _check_csrf(request)
    s = get_settings()
    if not s.github_client_id or not s.github_client_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "GitHub sign-in is not configured yet")
    try:
        _state, cookie, url = oauth_github.new_pkce_state()
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    from app.modules.identity.cookies import set_oauth_cookie
    set_oauth_cookie(response, cookie)
    return schemas.OAuthStartResponse(authorization_url=url)


@router.post("/oauth/github/callback", response_model=schemas.LoginResponse)
def oauth_github_callback(body: schemas.OAuthCallbackIn, request: Request, response: Response,
                          db: Session = Depends(get_db)):
    _check_csrf(request)
    from app.modules.identity.cookies import clear_oauth_cookie, read_oauth_cookie
    s = get_settings()
    if not s.github_client_id or not s.github_client_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "GitHub sign-in is not configured yet")
    verifier = oauth_github.parse_cookie(read_oauth_cookie(request) or "", body.state)
    clear_oauth_cookie(response)
    if not verifier:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "GitHub sign-in could not be completed")
    try:
        result = oauth_github.exchange(body.code, verifier)
    except Exception as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "GitHub sign-in could not be completed") from exc
    profile = result.get("profile") or {}
    if not oauth_github.is_allowed_github_account(profile):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This app is private.")
    primary = result.get("primary_email") or {}
    email = (primary.get("email") or "").strip().lower()
    if not email or not primary.get("verified"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "GitHub sign-in needs a verified primary email")
    subject = str(profile.get("id") or "")
    identity = db.scalar(select(AuthIdentity).where(AuthIdentity.provider == "github", AuthIdentity.subject == subject))
    owner = db.scalar(select(User).where(User.role == "owner"))
    if owner is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This app is private.")
    user = db.get(User, identity.user_id) if identity else owner
    if user is None or user.role != "owner" or (identity and identity.user_id != owner.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This app is private.")
    if not identity:
        db.add(AuthIdentity(user_id=owner.id, provider="github", subject=subject, email=email, email_verified=True))
        user = owner
    token, sess = start_session(db, user, request, method="github")
    db.commit()
    set_session_cookie(response, token, max_age=_cookie_age(sess))
    full = not sess.mfa_pending and not sess.enrolment_required
    return schemas.LoginResponse(mfa_required=sess.mfa_pending, mfa_enrolment_required=sess.enrolment_required,
                                 user=schemas.UserOut.from_user(user) if full else None)


@router.post("/password/forgot", status_code=202)
def password_forgot(body: schemas.PasswordResetRequest, request: Request, db: Session = Depends(get_db)):
    _check_csrf(request)
    try:
        return pwreset.request_code(db, body.login_id(), request)
    except pwreset.ResetError as exc:
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
        raise HTTPException(exc.status, str(exc), headers=headers) from exc


@router.post("/password/reset")
def password_reset_confirm(body: schemas.PasswordResetConfirm, request: Request, db: Session = Depends(get_db)):
    _check_csrf(request)
    try:
        pwreset.confirm_code(db, body.identifier, body.code, body.password, request)
    except pwreset.ResetError as exc:
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
        raise HTTPException(exc.status, str(exc), headers=headers) from exc
    return {"status": "ok"}


@router.post("/password/recovery")
def password_reset_recovery(body: schemas.PasswordRecoveryReset, request: Request, db: Session = Depends(get_db)):
    _check_csrf(request)
    try:
        pwreset.confirm_recovery(db, body.identifier, body.recovery_code, body.password, request)
    except pwreset.ResetError as exc:
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
        raise HTTPException(exc.status, str(exc), headers=headers) from exc
    return {"status": "ok"}


@router.post("/password/set")
def password_set(body: schemas.PasswordSetIn, request: Request, response: Response,
                 db: Session = Depends(get_db), found=Depends(require_recent_auth())):
    _check_csrf(request)
    sess, user = found
    if user.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This app is private.")
    try:
        pwreset.set_password(db, user, body.password, request)
    except pwreset.ResetError as exc:
        raise HTTPException(exc.status, str(exc)) from exc
    return {"status": "ok", "user": schemas.UserOut.from_user(user)}


@router.post("/recovery", status_code=202)
def recovery(body: schemas.PasswordResetRequest, request: Request, db: Session = Depends(get_db)):
    """Backward-compatible alias of /password/forgot."""
    return password_forgot(body, request, db)




@router.post("/invite/preview")
def invite_preview(request: Request, response: Response, db: Session = Depends(get_db),
                   body: schemas.InvitePreviewIn | None = None):
    _check_csrf(request)
    if get_settings().registration_mode != "invite":
        raise HTTPException(status.HTTP_403_FORBIDDEN, invites.GENERIC)
    raw = ((body.token if body else None) or read_invite_token(request) or "").strip()
    row = invites.lookup(db, raw)
    if not invites.is_usable(row):
        clear_invite_cookie(response)
        raise HTTPException(status.HTTP_403_FORBIDDEN, invites.GENERIC)
    set_invite_cookie(response, raw)
    return invites.preview(row)


@router.post("/invites")
def create_invite(body: schemas.InviteCreateIn, request: Request, db: Session = Depends(get_db),
                  found=Depends(require_recent_auth())):
    _check_csrf(request)
    _, user = found
    if user.role not in {"owner", "admin"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner or an admin can create invites")
    if get_settings().registration_mode != "invite":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Set registration mode to invite before creating invites")
    try:
        raw = invites.issue(db, email=str(body.email), role=body.role, created_by=user.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    record(db, user, "auth.invite.created", "user", user.id, request=request,
           detail={"email": str(body.email).lower(), "role": body.role})
    db.commit()
    base = get_settings().public_base_url.rstrip("/")
    return {"email": str(body.email).lower(), "role": body.role, "expires_in_hours": 72,
            "invite_url": f"{base}/invite#{raw}", "token": raw}
