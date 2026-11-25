"""Round 3 auth P0: cookie name, MFA rotation, CSRF origin, closed sign-up, lockout."""
import pyotp

from tests.conftest import PASSWORD, login, make_client


def test_session_cookie_is_host_prefixed(world):
    c = login("op@ragi.local")
    assert c.cookies.get("__Host-ragi_session")
    assert not c.cookies.get("ragi_session")


def test_mfa_verify_rotates_the_token(world):
    c = make_client()
    r = c.post("/api/v1/auth/login", json={"email": "owner@ragi.local", "password": PASSWORD})
    assert r.status_code == 200 and r.json()["mfa_required"] is True
    before = c.cookies.get("__Host-ragi_session")
    r = c.post("/api/v1/auth/verify", json={"code": pyotp.TOTP(world.totp_secret).now()})
    assert r.status_code == 200, r.text
    after = c.cookies.get("__Host-ragi_session")
    assert after and after != before
    # old token no longer works
    c.cookies.set("__Host-ragi_session", before)
    assert c.get("/api/v1/auth/me").status_code == 401


def test_login_without_csrf_or_origin_is_forbidden():
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app, base_url="https://testserver")
    r = c.post("/api/v1/auth/login", json={"email": "a@b.c", "password": "xxxxxxxxxxxx"})
    assert r.status_code == 403


def test_login_from_evil_origin_is_forbidden():
    c = make_client()
    r = c.post("/api/v1/auth/login", json={"email": "a@b.c", "password": "xxxxxxxxxxxx"},
               headers={"Origin": "https://evil.example"})
    assert r.status_code == 403


def test_lockout_response_is_the_same_for_unknown_and_known_emails(world):
    def hammer(email):
        c = make_client()
        statuses = []
        bodies = []
        for _ in range(6):
            r = c.post("/api/v1/auth/login", json={"email": email, "password": "definitely-wrong-pass"})
            statuses.append(r.status_code)
            bodies.append(r.json())
        return statuses, bodies

    s1, b1 = hammer("owner@ragi.local")
    s2, b2 = hammer("no-such-user@ragi.local")
    assert s1 == s2
    assert b1 == b2
    assert 429 in s1  # backoff after 5 failures


def test_registration_is_closed_without_setup_token(world):
    c = make_client()
    r = c.post("/api/v1/auth/register", json={
        "email": "new@ragi.local", "password": "correct-horse-battery", "full_name": "New Owner",
    })
    assert r.status_code == 403
    cfg = c.get("/api/v1/auth/config").json()
    assert cfg["registration_mode"] == "closed"
    assert cfg["providers"] == {"google": False, "apple": False}
    assert cfg["password_reset"] == "cli"


def test_oauth_start_disabled_without_client_id():
    c = make_client()
    assert c.post("/api/v1/auth/oauth/google/start").status_code == 503


GENERIC_INVITE = "This invite can’t be used. Ask the owner for a new one."


def test_invite_works_once_and_failures_are_generic(world):
    from app.core.config import get_settings
    s = get_settings()
    prev = s.registration_mode
    s.registration_mode = "invite"
    try:
        owner = login("owner@ragi.local", world.totp_secret)
        r = owner.post("/api/v1/auth/invites", json={"email": "new@ragi.local", "role": "operator"})
        assert r.status_code == 200, r.text
        raw = r.json()["token"]
        assert raw and "/invite#" in r.json()["invite_url"]

        c = make_client()
        bad = c.post("/api/v1/auth/invite/preview", json={"token": "not-a-real-token"})
        assert bad.status_code == 403
        assert bad.json()["detail"] == GENERIC_INVITE

        preview = c.post("/api/v1/auth/invite/preview", json={"token": raw})
        assert preview.status_code == 200, preview.text
        assert preview.json()["email"] == "new@ragi.local"
        assert preview.json()["role"] == "operator"
        assert c.cookies.get("__Host-ragi_invite")

        mismatch = c.post("/api/v1/auth/register", json={
            "email": "other@ragi.local", "password": "correct-horse-battery",
            "full_name": "Other", "invite_token": raw,
        })
        assert mismatch.status_code == 403
        assert mismatch.json()["detail"] == GENERIC_INVITE

        ok = c.post("/api/v1/auth/register", json={
            "email": "new@ragi.local", "password": "correct-horse-battery",
            "full_name": "New Operator", "invite_token": raw,
        })
        assert ok.status_code == 200, ok.text
        me = c.get("/api/v1/auth/me")
        assert me.status_code == 200
        assert me.json()["role"] == "operator"
        assert me.json()["email"] == "new@ragi.local"

        reuse = make_client().post("/api/v1/auth/register", json={
            "email": "new@ragi.local", "password": "correct-horse-battery",
            "full_name": "New Operator", "invite_token": raw,
        })
        assert reuse.status_code == 403
        assert reuse.json()["detail"] == GENERIC_INVITE
    finally:
        s.registration_mode = prev


def test_invite_is_rejected_when_registration_is_closed(world):
    from app.core.config import get_settings
    s = get_settings()
    prev = s.registration_mode
    s.registration_mode = "invite"
    try:
        owner = login("owner@ragi.local", world.totp_secret)
        raw = owner.post("/api/v1/auth/invites", json={"email": "late@ragi.local", "role": "viewer"}).json()["token"]
    finally:
        s.registration_mode = "closed"
    try:
        c = make_client()
        preview = c.post("/api/v1/auth/invite/preview", json={"token": raw})
        assert preview.status_code == 403
        assert preview.json()["detail"] == GENERIC_INVITE
        reg = c.post("/api/v1/auth/register", json={
            "email": "late@ragi.local", "password": "correct-horse-battery",
            "full_name": "Late", "invite_token": raw,
        })
        assert reg.status_code == 403
        assert reg.json()["detail"] == GENERIC_INVITE
    finally:
        s.registration_mode = prev
