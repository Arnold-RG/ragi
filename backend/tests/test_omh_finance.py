"""Finance-summary client and dashboard/integrations wiring (agreed OMH route)."""
from unittest.mock import patch

import httpx

from app.core.config import get_settings
from app.integrations.omh.client import finance_summary


OK = {
    "source": "omh",
    "schema_version": "1.0",
    "as_of": "2026-11-25",
    "month": "2026-11",
    "has_data": True,
    "by_currency": {"PLN": {"balance": {"amount": "100.00", "minor": 10000, "currency": "PLN"}}},
    "ai_budgets": [],
    "note": "Amounts are per currency and are never added across currencies.",
}


def _response(status: int, data, url="http://127.0.0.1:8420/api/v1/finance-summary"):
    return httpx.Response(status, json=data, request=httpx.Request("GET", url))


def test_finance_summary_not_configured():
    assert finance_summary()["connected"] is False


def test_finance_summary_calls_agreed_route_and_connects(monkeypatch):
    monkeypatch.setattr(get_settings(), "omh_api_url", "http://127.0.0.1:8420")
    captured: dict = {}

    def fake_get(url, params=None, headers=None, timeout=None):
        captured["url"] = url
        captured["params"] = params
        captured["headers"] = headers
        return _response(200, OK, url)

    with patch("app.integrations.omh.client.httpx.get", side_effect=fake_get):
        out = finance_summary()
    assert captured["url"] == "http://127.0.0.1:8420/api/v1/finance-summary"
    assert "/reports/summary" not in captured["url"]
    assert captured["params"] == {"organization_id": "arnovagroup"}
    assert captured["headers"]["X-Arnova-Key-Id"]
    assert captured["headers"]["X-Arnova-Timestamp"]
    assert captured["headers"]["X-Arnova-Signature"].startswith("sha256=")
    assert out["connected"] is True
    assert out["source"] == "omh"
    assert out["by_currency"]["PLN"]["balance"]["minor"] == 10000


def test_finance_summary_503_is_not_connected(monkeypatch):
    monkeypatch.setattr(get_settings(), "omh_api_url", "http://127.0.0.1:8420")
    with patch("app.integrations.omh.client.httpx.get",
               return_value=_response(503, {"detail": "Service authentication is not configured"})):
        out = finance_summary()
    assert out["connected"] is False
    assert "not configured" in out["message"].lower()


def test_finance_summary_unreachable(monkeypatch):
    monkeypatch.setattr(get_settings(), "omh_api_url", "http://127.0.0.1:8420")
    with patch("app.integrations.omh.client.httpx.get", side_effect=httpx.ConnectError("down")):
        out = finance_summary()
    assert out["connected"] is False
    assert "unreachable" in out["message"].lower()


def test_dashboard_summary_includes_omh(as_owner, monkeypatch):
    monkeypatch.setattr("app.modules.dashboard.router.finance_summary",
                        lambda: {"connected": True, "source": "omh", "has_data": False, "by_currency": {}})
    s = as_owner.get("/api/v1/dashboard/summary").json()
    assert s["omh"]["connected"] is True
    assert s["omh"]["source"] == "omh"


def test_integrations_uses_live_omh_status(as_owner, monkeypatch):
    monkeypatch.setattr("app.modules.finance_bridge.router.finance_summary",
                        lambda: {"connected": False, "source": "omh", "message": "Service authentication is not configured"})
    items = {i["id"]: i for i in as_owner.get("/api/v1/integrations").json()["items"]}
    assert items["omh"]["connected"] is False
    assert "not configured" in items["omh"]["detail"].lower()
