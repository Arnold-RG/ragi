"""Owner trusted-device cookie: TOTP-only unlock, lockout, and revocation."""
from datetime import UTC, datetime, timedelta

import pyotp

from tests.conftest import PASSWORD, login, make_client


def next_totp(secret: str) -> str:
    # Skip the current 30s window so a just-used code is not rejected as replay.
    return pyotp.TOTP(secret).at(datetime.now(UTC) + timedelta(seconds=30))


def _owner_login(world):
    return login("owner@ragi.local", world.totp_secret)


def test_full_login_sets_trusted_device_cookie(world):
    c = _owner_login(world)
    assert c.cookies.get("__Host-ragi_trusted")
    items = c.get("/api/v1/auth/trusted-devices").json()["items"]
    assert len(items) == 1
    assert items[0]["current"] is True
    assert items[0]["label"]


def test_operator_does_not_get_a_trusted_device(world):
    c = login("op@ragi.local")
    assert not c.cookies.get("__Host-ragi_trusted")
    assert c.get("/api/v1/auth/trusted-devices").status_code == 403


def test_unlock_with_totp_after_session_expires(world):
    c = _owner_login(world)
    trusted = c.cookies.get("__Host-ragi_trusted")
    assert trusted
    # Drop the session, keep the trusted-device cookie.
    c.cookies.set("__Host-ragi_session", "", domain="testserver", path="/")
    c.cookies.delete("__Host-ragi_session")
    # TestClient may keep the session cookie; overwrite with a junk value.
    sess_name = "__Host-ragi_session"
    if c.cookies.get(sess_name):
        # expire it via logout is easier — but logout requires a session.
        # Use a fresh client that only has the trusted cookie.
        pass
    bare = make_client()
    bare.cookies.set("__Host-ragi_trusted", trusted)
    hint = bare.get("/api/v1/auth/trusted-device").json()
    assert hint["available"] is True
    assert hint["display_name"]
    assert bare.get("/api/v1/auth/me").status_code == 401
    r = bare.post("/api/v1/auth/unlock", json={"code": next_totp(world.totp_secret)})
    assert r.status_code == 200, r.text
    assert r.json()["mfa_required"] is False
    assert r.json()["user"]["email"] == "owner@ragi.local"
    assert bare.get("/api/v1/auth/me").status_code == 200


def test_unlock_rejects_bad_codes_and_locks(world):
    c = _owner_login(world)
    trusted = c.cookies.get("__Host-ragi_trusted")
    bare = make_client()
    bare.cookies.set("__Host-ragi_trusted", trusted)
    statuses = []
    for _ in range(5):
        r = bare.post("/api/v1/auth/unlock", json={"code": "000000"})
        statuses.append(r.status_code)
    assert statuses[:4] == [401, 401, 401, 401]
    assert statuses[4] == 429
    # Even a valid code is refused while locked.
    r = bare.post("/api/v1/auth/unlock", json={"code": next_totp(world.totp_secret)})
    assert r.status_code == 429


def test_unlock_without_trusted_cookie_requires_password(world):
    c = make_client()
    assert c.get("/api/v1/auth/trusted-device").json() == {"available": False}
    r = c.post("/api/v1/auth/unlock", json={"code": "123456"})
    assert r.status_code == 401


def test_revoke_device_and_revoke_all(world):
    c = _owner_login(world)
    trusted = c.cookies.get("__Host-ragi_trusted")
    items = c.get("/api/v1/auth/trusted-devices").json()["items"]
    assert items
    device_id = items[0]["id"]
    assert c.delete(f"/api/v1/auth/trusted-devices/{device_id}").status_code == 204
    assert c.get("/api/v1/auth/trusted-devices").json()["items"] == []
    bare = make_client()
    bare.cookies.set("__Host-ragi_trusted", trusted)
    assert bare.get("/api/v1/auth/trusted-device").json()["available"] is False

    c2 = make_client()
    r = c2.post("/api/v1/auth/login", json={"email": "owner@ragi.local", "password": PASSWORD})
    assert r.status_code == 200 and r.json()["mfa_required"] is True
    r = c2.post("/api/v1/auth/verify", json={"code": next_totp(world.totp_secret)})
    assert r.status_code == 200, r.text
    assert c2.get("/api/v1/auth/trusted-devices").json()["items"]
    assert c2.delete("/api/v1/auth/trusted-devices").status_code == 204
    assert c2.get("/api/v1/auth/trusted-devices").json()["items"] == []
