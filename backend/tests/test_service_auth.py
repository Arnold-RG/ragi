import json
import time
import uuid
from datetime import UTC, datetime

from app.core.security import sign_body
from app.integrations.omh.client import reserve_budget
from app.core.service_auth import signed_headers, verify_request, load_keyring
from tests.conftest import KEYRING, make_client

import pytest

SECRETS = {k["kid"]: k["secret"] for k in KEYRING["keys"]}


def envelope(event_type="invoice.paid", source="omh", data=None, event_id=None):
    return {"schema_version": "1.0", "event_id": event_id or f"omh-{uuid.uuid4()}", "event_type": event_type,
            "source": source, "organization_id": "arnovagroup", "project_id": None,
            "occurred_at": datetime.now(UTC).isoformat(), "data": data or {}}


def post(body: dict, kid="omh-test", ts=None, secret=None):
    raw = json.dumps(body).encode()
    ts = str(ts if ts is not None else int(time.time()))
    sig = sign_body(secret or SECRETS[kid], ts, raw)
    return make_client().post("/api/v1/events", content=raw, headers={
        "Content-Type": "application/json", "X-Arnova-Key-Id": kid, "X-Arnova-Timestamp": ts, "X-Arnova-Signature": sig})


def test_valid_event_accepted_and_deduplicated(world):
    body = envelope()
    assert post(body).json()["status"] == "accepted"
    assert post(body).json()["status"] == "duplicate"


def test_rotation_both_active_keys_work(world):
    assert post(envelope(), kid="omh-test").status_code == 202
    assert post(envelope(), kid="omh-next").status_code == 202


def test_expired_key_rejected(world):
    assert post(envelope(), kid="omh-old").status_code == 401


def test_wrong_scope_rejected(world):
    assert post(envelope(), kid="omh-readonly").status_code == 401


def test_bad_signature_rejected(world):
    assert post(envelope(), secret="z" * 40).status_code == 401


def test_stale_timestamp_rejected(world):
    assert post(envelope(), ts=int(time.time()) - 3600).status_code == 401


def test_source_must_match_signing_service(world):
    # RAGI's own key cannot inject events pretending to be OMH, and OMH cannot claim to be GitHub.
    assert post(envelope(source="omh"), kid="ragi-test").status_code == 403
    assert post(envelope(event_type="deployment.completed", source="github"), kid="omh-test").status_code == 403


def test_unsupported_event_type_rejected(world):
    assert post(envelope(event_type="project.created")).status_code == 422


def test_missing_headers_rejected(world):
    r = make_client().post("/api/v1/events", content=json.dumps(envelope()).encode())
    assert r.status_code == 401


def test_signed_headers_roundtrip():
    body = b'{"x":1}'
    h = {k.lower(): v for k, v in signed_headers(body).items()}
    key = verify_request(h, body, scope="budget:reserve", keyring=load_keyring())
    assert key.service == "ragi"


def test_keyring_rejects_short_secrets(tmp_path):
    p = tmp_path / "k.json"
    p.write_text(json.dumps({"keys": [{"kid": "a", "service": "omh", "secret": "short"}]}))
    with pytest.raises(ValueError):
        load_keyring(str(p))


def test_reservation_refuses_plain_http_to_remote(monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "omh_api_url", "http://omh.example.com")
    d = reserve_budget(agent_id="forge", project_id=None, run_id="r",
                       estimated_cost={"amount": "1.00", "currency": "USD"})
    assert not d.available and "https" in d.reason


def test_reservation_without_estimate_fails_closed():
    d = reserve_budget(agent_id="forge", project_id=None, run_id="r")
    assert not d.available and "estimate" in d.reason


def test_reservation_without_omh_fails_closed():
    d = reserve_budget(agent_id="forge", project_id=None, run_id="r", estimated_cost={"amount": "1.00", "currency": "USD"})
    assert not d.available


