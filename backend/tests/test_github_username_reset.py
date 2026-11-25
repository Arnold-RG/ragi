"""Open registration, usernames, GitHub-only social login, and password reset."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.core.config import get_settings
from app.core.recovery import issue_codes
from app.core.security import hash_password
from app.modules.identity.models import PasswordResetCode, User
from tests.conftest import PASSWORD, make_client, world  # noqa: F401


def test_username_rules_and_unique(world):
    from app.core import usernames
    assert usernames.validate_username("Ada_Lovelace") == "ada_lovelace"
    for bad in ("ab", "1abc", "has-dash", "Admin", "ragi"):
        try:
            usernames.validate_username(bad)
            raise AssertionError(bad)
        except ValueError:
            pass


def test_open_signup_and_login_with_email_or_username(world):
    s = get_settings()
    prev, prev_c = s.registration_mode, s.registration_open_confirmed
    s.registration_mode = "open"
    s.registration_open_confirmed = True
    try:
        c = make_client()
        r = c.post("/api/v1/auth/register", json={
            "email": "ada@ragi.local", "username": "ada_lovelace",
            "password": "correct-horse-battery-staple", "full_name": "Ada Lovelace",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["recovery_codes"] and len(body["recovery_codes"]) == 10
        me = c.get("/api/v1/auth/me").json()
        assert me["username"] == "ada_lovelace"
        assert me["has_password"] is True
        # Unique username
        other = make_client().post("/api/v1/auth/register", json={
            "email": "ada2@ragi.local", "username": "ADA_LOVELACE",
            "password": "correct-horse-battery-staple", "full_name": "Ada Two",
        })
        assert other.status_code == 409
        # Login with username and email
        a = make_client()
        assert a.post("/api/v1/auth/login", json={"identifier": "ada_lovelace", "password": PASSWORD}).status_code == 200
        b = make_client()
        assert b.post("/api/v1/auth/login", json={"email": "ada@ragi.local", "password": PASSWORD}).status_code == 200
    finally:
        s.registration_mode, s.registration_open_confirmed = prev, prev_c


def test_github_start_uses_state_and_pkce(monkeypatch, world):
    s = get_settings()
    s.github_client_id = "client-id"
    s.github_client_secret = "client-secret"
    try:
        c = make_client()
        r = c.post("/api/v1/auth/oauth/github/start")
        assert r.status_code == 200, r.text
        url = r.json()["authorization_url"]
        assert "code_challenge=" in url and "code_challenge_method=S256" in url
        assert "state=" in url and "client_id=client-id" in url
        assert c.cookies.get("__Host-ragi_oauth")
        assert c.post("/api/v1/auth/oauth/apple/start").status_code == 404
    finally:
        s.github_client_id = ""
        s.github_client_secret = ""


def test_github_links_existing_account_by_verified_email(monkeypatch, world):
    from app.core import oauth_github

    s = get_settings()
    s.github_client_id = "client-id"
    s.github_client_secret = "client-secret"
    s.registration_mode = "closed"

    def fake_parse(blob, state):
        return "verifier" if state == "abc" else None

    def fake_exchange(code, verifier):
        assert code == "gh-code" and verifier == "verifier"
        return {"profile": {"id": 137049568, "login": "Arnold-RG", "name": "Arnold"},
                "primary_email": {"email": "owner@ragi.local", "verified": True, "primary": True}}

    monkeypatch.setattr(oauth_github, "parse_cookie", fake_parse)
    monkeypatch.setattr(oauth_github, "exchange", fake_exchange)
    try:
        c = make_client()
        c.cookies.set("__Host-ragi_oauth", "blob", path="/")
        r = c.post("/api/v1/auth/oauth/github/callback", json={"code": "gh-code", "state": "abc"})
        # owner has MFA enabled, so first factor should succeed with mfa required
        assert r.status_code == 200, r.text
        assert r.json()["mfa_required"] is True
    finally:
        s.github_client_id = ""
        s.github_client_secret = ""
        s.registration_mode = "closed"


def test_github_does_not_create_account_when_registration_is_closed(monkeypatch, world):
    from app.core import oauth_github

    s = get_settings()
    s.github_client_id = "client-id"
    s.github_client_secret = "client-secret"
    s.registration_mode = "closed"
    monkeypatch.setattr(oauth_github, "parse_cookie", lambda blob, state: "verifier")
    monkeypatch.setattr(oauth_github, "exchange", lambda code, verifier: {
        "profile": {"id": 99, "login": "newbie"},
        "primary_email": {"email": "newbie@ragi.local", "verified": True, "primary": True},
    })
    try:
        c = make_client()
        c.cookies.set("__Host-ragi_oauth", "blob", path="/")
        r = c.post("/api/v1/auth/oauth/github/callback", json={"code": "x", "state": "y"})
        assert r.status_code == 403
    finally:
        s.github_client_id = ""
        s.github_client_secret = ""


def test_password_reset_email_code_is_generic_and_single_use(world):
    from app.modules.identity.password_reset import _hasher

    c = make_client()
    missing = c.post("/api/v1/auth/password/forgot", json={"identifier": "nobody@ragi.local"})
    exists = c.post("/api/v1/auth/password/forgot", json={"identifier": "owner@ragi.local"})
    assert missing.status_code == 202 and exists.status_code == 202
    assert missing.json()["message"] == exists.json()["message"]

    db = world.db
    db.expire_all()
    row = db.query(PasswordResetCode).filter(PasswordResetCode.user_id == world.owner.id).one()
    # Recover the plaintext by issuing a known code instead
    row.used_at = datetime.now(UTC)
    db.flush()
    known = "123456"
    row2 = PasswordResetCode(
        user_id=world.owner.id, code_hash=_hasher.hash(known),
        expires_at=datetime.now(UTC) + timedelta(minutes=15),
    )
    db.add(row2)
    db.commit()
    assert c.post("/api/v1/auth/password/reset", json={
        "identifier": "owner_ragi", "code": "123456", "password": "new-horse-battery-1",
    }).status_code == 200
    # Single use
    assert c.post("/api/v1/auth/password/reset", json={
        "identifier": "owner_ragi", "code": "123456", "password": "new-horse-battery-2",
    }).status_code == 400
    fresh = make_client()
    assert fresh.post("/api/v1/auth/login", json={"identifier": "owner_ragi", "password": "new-horse-battery-1"}).status_code == 200


def test_password_reset_with_recovery_code(world):
    db = world.db
    codes = issue_codes(db, world.owner.id)
    db.commit()
    c = make_client()
    r = c.post("/api/v1/auth/password/recovery", json={
        "identifier": "owner@ragi.local", "recovery_code": codes[0], "password": "recovery-battery-99",
    })
    assert r.status_code == 200, r.text
    # used code cannot be reused
    assert c.post("/api/v1/auth/password/recovery", json={
        "identifier": "owner@ragi.local", "recovery_code": codes[0], "password": "recovery-battery-00",
    }).status_code == 400
    fresh = make_client()
    logged = fresh.post("/api/v1/auth/login", json={"email": "owner@ragi.local", "password": "recovery-battery-99"})
    assert logged.status_code == 200
    assert logged.json()["mfa_required"] is True


def test_set_password_after_login(world):
    import pyotp
    from tests.conftest import login
    c = login("owner@ragi.local", world.totp_secret)
    r = c.post("/api/v1/auth/password/set", json={"password": "after-github-battery"})
    assert r.status_code == 200, r.text
    fresh = make_client()
    first = fresh.post("/api/v1/auth/login", json={"email": "owner@ragi.local", "password": "after-github-battery"})
    assert first.status_code == 200
    assert first.json()["mfa_required"] is True


def test_github_rejects_any_other_account(monkeypatch, world):
    from app.core import oauth_github

    s = get_settings()
    s.github_client_id = "client-id"
    s.github_client_secret = "client-secret"
    monkeypatch.setattr(oauth_github, "parse_cookie", lambda blob, state: "verifier")
    monkeypatch.setattr(oauth_github, "exchange", lambda code, verifier: {
        "profile": {"id": 1, "login": "someone-else"},
        "primary_email": {"email": "owner@ragi.local", "verified": True, "primary": True},
    })
    try:
        c = make_client()
        c.cookies.set("__Host-ragi_oauth", "blob", path="/")
        r = c.post("/api/v1/auth/oauth/github/callback", json={"code": "x", "state": "y"})
        assert r.status_code == 403
        assert "private" in r.json()["detail"].lower()
    finally:
        s.github_client_id = ""
        s.github_client_secret = ""


def test_password_reset_is_silent_for_non_owners(world):
    c = make_client()
    r = c.post("/api/v1/auth/password/forgot", json={"identifier": "viewer@ragi.local"})
    assert r.status_code == 202
    from sqlalchemy import select
    from app.modules.identity.models import PasswordResetCode
    world.db.expire_all()
    rows = world.db.scalars(select(PasswordResetCode).where(PasswordResetCode.user_id == world.viewer.id)).all()
    assert rows == []
