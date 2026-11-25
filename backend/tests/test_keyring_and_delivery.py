"""Keyring JSON loading. Outbound delivery to other apps is disabled."""
import json

import pytest

from app.core.config import get_settings
from app.core.service_auth import load_keyring
from app.events.delivery import backoff_seconds
from tests.conftest import KEYRING


def test_load_keyring_prefers_json_over_file(monkeypatch, tmp_path):
    other = tmp_path / "other.json"
    other.write_text(json.dumps({"keys": [{"kid": "file-only", "service": "ragi", "secret": "f" * 40, "scopes": ["events:write"]}]}))
    monkeypatch.setattr(get_settings(), "ecosystem_keyring_file", str(other))
    monkeypatch.setattr(get_settings(), "ecosystem_keyring_json", json.dumps(KEYRING))
    keys = load_keyring()
    assert "ragi-test" in keys
    assert "file-only" not in keys


def test_load_keyring_json_rejects_short_secrets(monkeypatch):
    monkeypatch.setattr(get_settings(), "ecosystem_keyring_json", json.dumps({
        "keys": [{"kid": "x", "service": "ragi", "secret": "too-short", "scopes": []}]
    }))
    monkeypatch.setattr(get_settings(), "ecosystem_keyring_file", "")
    with pytest.raises(ValueError):
        load_keyring()


def test_backoff_covers_cold_start():
    assert backoff_seconds(0) == 0
    assert backoff_seconds(1) == 5
    assert backoff_seconds(6) == 180
    assert backoff_seconds(99) == 180


def test_delivery_is_disabled():
    from app.events.delivery import configured
    assert configured() is False
