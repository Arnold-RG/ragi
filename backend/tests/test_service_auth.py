import json
from pathlib import Path

import pytest

from app.core.service_auth import load_keyring, signed_headers, verify_request
from tests.conftest import login


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


def test_inbound_events_are_unavailable(world):
    c = login("op@ragi.local")
    assert c.post("/api/v1/events", json={}).status_code == 404
