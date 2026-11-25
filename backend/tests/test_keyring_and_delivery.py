"""Keyring JSON, outbox delivery, and OMH finance summary client."""
import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.core.config import get_settings
from app.core.service_auth import load_keyring, signed_headers
from app.events.delivery import backoff_seconds, deliver_one, pump_once
from app.events.models import EventOutbox
from app.integrations.omh.client import fetch_summary
from tests.conftest import KEYRING, make_client, login


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


def test_delivery_success_marks_delivered(world, db, monkeypatch):
    row = EventOutbox(event_id="ragi-delivery-1", event_type="billing.handoff.ready",
                      payload={"schema_version": "1.0", "event_id": "ragi-delivery-1", "event_type": "billing.handoff.ready",
                               "source": "ragi", "organization_id": "arnovagroup", "project_id": None,
                               "occurred_at": datetime.now(UTC).isoformat(), "data": {}},
                      status="pending")
    db.add(row)
    db.commit()

    class FakeResp:
        status_code = 202

    monkeypatch.setattr("app.events.delivery._post", lambda url, body, headers: FakeResp())
    monkeypatch.setattr(get_settings(), "omh_api_url", "https://omh.example.test")
    assert pump_once() == 1
    db.refresh(row)
    assert row.status == "delivered" and row.delivered_at is not None


def test_delivery_retries_on_cold_start(world, db, monkeypatch):
    row = EventOutbox(event_id="ragi-delivery-2", event_type="billing.handoff.ready",
                      payload={"schema_version": "1.0", "event_id": "ragi-delivery-2", "event_type": "billing.handoff.ready",
                               "source": "ragi", "organization_id": "arnovagroup", "project_id": None,
                               "occurred_at": datetime.now(UTC).isoformat(), "data": {}},
                      status="pending")
    db.add(row)
    db.commit()

    class FakeResp:
        status_code = 502

    monkeypatch.setattr("app.events.delivery._post", lambda url, body, headers: FakeResp())
    monkeypatch.setattr(get_settings(), "omh_api_url", "https://omh.example.test")
    assert pump_once() == 0
    db.refresh(row)
    assert row.status == "pending" and row.attempts == 1 and row.next_attempt_at is not None
    # Not due yet — pump should skip
    assert pump_once() == 0
    assert row.attempts == 1


def test_fetch_summary_not_configured():
    result = fetch_summary()
    assert result.status == "not_configured"
    assert "not connected" in result.detail.lower() or "OMH" in result.detail


def test_fetch_summary_asleep(monkeypatch):
    monkeypatch.setattr(get_settings(), "omh_api_url", "https://omh.example.test")

    def boom(*a, **k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "get", boom)
    result = fetch_summary()
    assert result.status == "asleep"


def test_fetch_summary_ok(monkeypatch):
    monkeypatch.setattr(get_settings(), "omh_api_url", "https://omh.example.test")
    payload = {"source": "omh", "schema_version": "1.0", "as_of": "2026-11-25", "month": "2026-11",
               "has_data": True, "linked": True, "by_currency": {"PLN": {"balance": {"amount": "10.00", "currency": "PLN"}}},
               "ai_budgets": []}

    class FakeResp:
        status_code = 200
        def json(self):
            return payload

    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResp())
    result = fetch_summary()
    assert result.status == "ok" and result.payload["by_currency"]["PLN"]["balance"]["amount"] == "10.00"


def test_omh_summary_endpoint_fails_closed(as_operator):
    r = as_operator.get("/api/v1/integrations/omh/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "omh"
    assert body["status"] in {"not_configured", "asleep", "error", "unlinked", "ok"}
    # The dashboard summary itself stays free of money fields
    dash = as_operator.get("/api/v1/dashboard/summary").json()
    assert "by_currency" not in dash
