"""Test setup: an isolated SQLite database per test, test keys, no network."""
import json
import os
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="ragi-tests-"))
os.environ.update({
    "APP_ENV": "test",
    "DATABASE_URL": f"sqlite:///{_tmp / 'ragi-test.db'}",
    "FIELD_ENCRYPTION_KEY": "test-only-field-key-not-a-secret-0000000000",
    "ECOSYSTEM_KEYRING_FILE": str(_tmp / "keyring.json"),
    "ECOSYSTEM_SIGNING_KEY_ID": "ragi-test",
    "AGENTS_ENABLED": "false",
    "OMH_API_URL": "",
})
KEYRING = {"keys": [
    {"kid": "omh-test", "service": "omh", "secret": "o" * 40, "scopes": ["events:write"]},
    {"kid": "omh-next", "service": "omh", "secret": "n" * 40, "scopes": ["events:write"]},
    {"kid": "omh-old", "service": "omh", "secret": "x" * 40, "scopes": ["events:write"], "not_after": "2020-01-01T00:00:00Z"},
    {"kid": "omh-readonly", "service": "omh", "secret": "r" * 40, "scopes": ["finance:read"]},
    {"kid": "ragi-test", "service": "ragi", "secret": "g" * 40, "scopes": ["budget:reserve", "events:write"]},
]}
(_tmp / "keyring.json").write_text(json.dumps(KEYRING))

import pyotp  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.crypto import encrypt  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.database import models  # noqa: E402,F401
from app.database.base import Base  # noqa: E402
from app.database.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.agents.service import sync_profiles  # noqa: E402
from app.modules.clients.models import Client  # noqa: E402
from app.modules.identity.models import Organization, User  # noqa: E402

PASSWORD = "correct-horse-battery-staple"
ORIGIN = "http://localhost:3410"


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def db():
    s = SessionLocal()
    yield s
    s.close()


class World:
    def __init__(self, db):
        self.db = db
        self.org = Organization(slug="arnovagroup", name="Arnova Group")
        self.other_org = Organization(slug="otherco", name="Other Co")
        db.add_all([self.org, self.other_org])
        db.flush()
        self.totp_secret = pyotp.random_base32()
        self.owner = self.user("owner@ragi.local", "owner", mfa=True)
        self.operator = self.user("op@ragi.local", "operator")
        self.viewer = self.user("viewer@ragi.local", "viewer")
        self.admin = self.user("admin@ragi.local", "admin")
        self.other_operator = self.user("op@other.local", "operator", org=self.other_org)
        self.client_a = Client(organization_id=self.org.id, name="Client A")
        self.client_b = Client(organization_id=self.org.id, name="Client B")
        db.add_all([self.client_a, self.client_b])
        db.flush()
        self.portal = self.user("portal@ragi.local", "client", client_id=self.client_a.id)
        sync_profiles(db, self.org.id)
        sync_profiles(db, self.other_org.id)
        db.commit()

    def user(self, email, role, org=None, mfa=False, client_id=None):
        u = User(organization_id=(org or self.org).id, email=email, full_name=email.split("@")[0].title(), role=role,
                 password_hash=hash_password(PASSWORD), client_id=client_id)
        if mfa:
            u.mfa_secret_enc, u.mfa_enabled = encrypt(self.totp_secret), True
        self.db.add(u)
        self.db.flush()
        return u


@pytest.fixture
def world(db):
    return World(db)


def make_client() -> TestClient:
    c = TestClient(app, base_url="https://testserver")
    c.headers.update({"X-RAGI-Request": "1"})
    return c


def login(email: str, totp_secret: str | None = None) -> TestClient:
    c = make_client()
    r = c.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    if r.json()["mfa_required"]:
        assert totp_secret
        r = c.post("/api/v1/auth/verify", json={"code": pyotp.TOTP(totp_secret).now()})
        assert r.status_code == 200, r.text
    return c


@pytest.fixture
def as_operator(world):
    return login("op@ragi.local")


@pytest.fixture
def as_owner(world):
    return login("owner@ragi.local", world.totp_secret)
