
import pyotp
from sqlalchemy import select

from app.modules.audit.models import AuditLog
from app.modules.identity.models import User
from tests.conftest import PASSWORD, login, make_client


def test_login_success_sets_httponly_secure_cookie(world):
    c = make_client()
    r = c.post("/api/v1/auth/login", json={"email": "OP@ragi.local", "password": PASSWORD})
    assert r.status_code == 200
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "secure" in cookie and "samesite=lax" in cookie
    assert c.get("/api/v1/auth/me").json()["email"] == "op@ragi.local"


def test_wrong_password_and_lockout(world):
    c = make_client()
    for _ in range(5):
        assert c.post("/api/v1/auth/login", json={"email": "op@ragi.local", "password": "nope"}).status_code == 401
    r = c.post("/api/v1/auth/login", json={"email": "op@ragi.local", "password": PASSWORD})
    assert r.status_code == 429


def test_unknown_email_same_message(world):
    r = make_client().post("/api/v1/auth/login", json={"email": "ghost@ragi.local", "password": "x"})
    assert r.status_code == 401 and r.json()["detail"] == "Email or password is incorrect"


def test_writes_require_anti_csrf_header(world):
    c = login("op@ragi.local")
    del c.headers["X-RAGI-Request"]
    assert c.post("/api/v1/clients", json={"name": "X Co"}).status_code == 403


def test_owner_login_requires_totp(world):
    c = make_client()
    r = c.post("/api/v1/auth/login", json={"email": "owner@ragi.local", "password": PASSWORD})
    assert r.json()["mfa_required"] is True and r.json()["user"] is None
    assert c.get("/api/v1/auth/me").status_code == 401
    assert c.post("/api/v1/auth/verify", json={"code": pyotp.TOTP(world.totp_secret).now()}).status_code == 200
    assert c.get("/api/v1/auth/me").status_code == 200


def test_mfa_attempt_limit_locks_and_revokes_session(world):
    c = make_client()
    c.post("/api/v1/auth/login", json={"email": "owner@ragi.local", "password": PASSWORD})
    codes = [r.status_code for r in (c.post("/api/v1/auth/verify", json={"code": "000000"}) for _ in range(5))]
    assert codes[:4] == [401] * 4 and codes[4] == 429
    # The pending session is revoked and the user is MFA-locked, so even the right code fails now.
    assert c.post("/api/v1/auth/verify", json={"code": pyotp.TOTP(world.totp_secret).now()}).status_code == 401
    c2 = make_client()
    c2.post("/api/v1/auth/login", json={"email": "owner@ragi.local", "password": PASSWORD})
    assert c2.post("/api/v1/auth/verify", json={"code": pyotp.TOTP(world.totp_secret).now()}).status_code == 429


def test_totp_replay_rejected(world):
    code = pyotp.TOTP(world.totp_secret).now()
    c = make_client()
    c.post("/api/v1/auth/login", json={"email": "owner@ragi.local", "password": PASSWORD})
    assert c.post("/api/v1/auth/verify", json={"code": code}).status_code == 200
    c2 = make_client()
    c2.post("/api/v1/auth/login", json={"email": "owner@ragi.local", "password": PASSWORD})
    assert c2.post("/api/v1/auth/verify", json={"code": code}).status_code == 401


def test_mfa_secret_encrypted_at_rest(world, db):
    owner = db.scalar(select(User).where(User.email == "owner@ragi.local"))
    assert owner.mfa_secret_enc and world.totp_secret not in owner.mfa_secret_enc


def test_admin_without_mfa_must_enrol_before_anything_else(world, db):
    c = make_client()
    r = c.post("/api/v1/auth/login", json={"email": "admin@ragi.local", "password": PASSWORD})
    assert r.json()["mfa_enrolment_required"] is True
    assert c.get("/api/v1/projects").status_code == 403
    setup = c.post("/api/v1/auth/mfa/setup").json()
    stored = db.scalar(select(User).where(User.email == "admin@ragi.local"))
    db.refresh(stored)
    assert setup["secret"] not in (stored.mfa_secret_enc or "")
    assert c.post("/api/v1/auth/mfa/enable", json={"code": "123456"}).status_code == 400
    assert c.post("/api/v1/auth/mfa/enable", json={"code": pyotp.TOTP(setup["secret"]).now()}).status_code == 200
    assert c.get("/api/v1/projects").status_code == 200


def test_operator_does_not_need_mfa(world):
    assert login("op@ragi.local").get("/api/v1/projects").status_code == 200


def test_logout_revokes_session(world):
    c = login("op@ragi.local")
    assert c.post("/api/v1/auth/logout").status_code == 204
    c.cookies.clear()
    assert c.get("/api/v1/auth/me").status_code == 401


def test_recovery_never_reveals_accounts(world):
    a = make_client().post("/api/v1/auth/recovery", json={"email": "owner@ragi.local"})
    b = make_client().post("/api/v1/auth/recovery", json={"email": "nobody@ragi.local"})
    assert a.status_code == b.status_code == 202 and a.json() == b.json()


def test_failed_logins_are_audited(world, db):
    make_client().post("/api/v1/auth/login", json={"email": "op@ragi.local", "password": "bad"})
    assert db.scalar(select(AuditLog).where(AuditLog.action == "auth.login.failed"))


