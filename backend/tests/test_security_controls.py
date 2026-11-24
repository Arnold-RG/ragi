import socket

import httpx
import pytest
from starlette.websockets import WebSocketDisconnect

from app.core.config import Settings
from app.integrations.monitoring import http_check
from app.integrations.monitoring.http_check import UnsafeTarget, is_public_ip
from app.modules.reports.router import csv_safe
from tests.conftest import ORIGIN, login

import ipaddress


@pytest.mark.parametrize("ip", ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1",
                                "100.127.255.254", "0.0.0.0", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1",
                                "2002:7f00:1::1", "224.0.0.1"])
def test_internal_addresses_blocked(ip):
    assert not is_public_ip(ipaddress.ip_address(ip))


@pytest.mark.parametrize("ip", ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])
def test_public_addresses_allowed(ip):
    assert is_public_ip(ipaddress.ip_address(ip))


def _fake_dns(monkeypatch, table):
    def fake(host, *a, **k):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (table[host], 0))]
    monkeypatch.setattr(socket, "getaddrinfo", fake)


def test_redirect_to_internal_address_is_blocked(monkeypatch):
    _fake_dns(monkeypatch, {"public.example": "93.184.216.34", "evil.example": "169.254.169.254"})

    def requester(url):
        return httpx.Response(302, headers={"location": "http://evil.example/latest/meta-data"}, request=httpx.Request("GET", url))

    with pytest.raises(UnsafeTarget):
        http_check.check("https://public.example/", requester=requester)


def test_redirect_to_public_is_followed(monkeypatch):
    _fake_dns(monkeypatch, {"a.example": "93.184.216.34", "b.example": "93.184.216.35"})
    seen = []

    def requester(url):
        seen.append(url)
        if "a.example" in url:
            return httpx.Response(301, headers={"location": "https://b.example/home"}, request=httpx.Request("GET", url))
        return httpx.Response(200, request=httpx.Request("GET", url))

    assert http_check.check("https://a.example/", requester=requester).status == "up"
    assert seen == ["https://a.example/", "https://b.example/home"]


def test_cgnat_and_credentials_rejected(monkeypatch):
    _fake_dns(monkeypatch, {"cgnat.example": "100.64.10.10"})
    with pytest.raises(UnsafeTarget):
        http_check.resolve_public("http://cgnat.example/")
    with pytest.raises(UnsafeTarget):
        http_check.resolve_public("http://user:pw@example.com/")
    with pytest.raises(UnsafeTarget):
        http_check.resolve_public("file:///etc/passwd")


def test_website_check_endpoint_refuses_internal(world, monkeypatch):
    _fake_dns(monkeypatch, {"internal.example": "10.0.0.5"})
    c = login("op@ragi.local")
    w = c.post("/api/v1/websites", json={"label": "Internal", "url": "http://internal.example/"}).json()
    assert c.post(f"/api/v1/websites/{w['id']}/check").status_code == 422


@pytest.mark.parametrize("value", ["=HYPERLINK(\"http://x\")", "+1+1", "-2", "@SUM(A1)", "\tcmd", "\uff1d1"])
def test_csv_formula_neutralised(value):
    assert csv_safe(value).startswith("'")


def test_csv_plain_values_untouched():
    assert csv_safe("Sample client") == "Sample client" and csv_safe(12) == 12


def test_csv_export_neutralises_project_names(world):
    c = login("op@ragi.local")
    c.post("/api/v1/projects", json={"name": "=cmd|' /C calc'!A0"})
    body = c.get("/api/v1/reports/operations?format=csv").text
    assert "'=cmd" in body


def test_websocket_rejects_foreign_origin(world):
    c = login("op@ragi.local")
    cookie = f"ragi_session={c.cookies.get('ragi_session')}"
    with pytest.raises(WebSocketDisconnect) as exc:
        with c.websocket_connect("/ws/operations", headers={"origin": "https://evil.example", "cookie": cookie}) as ws:
            ws.receive_json()
    assert exc.value.code == 4403


def test_websocket_rejects_missing_session(world):
    from tests.conftest import make_client
    with pytest.raises(WebSocketDisconnect) as exc:
        with make_client().websocket_connect("/ws/operations", headers={"origin": ORIGIN}) as ws:
            ws.receive_json()
    assert exc.value.code == 4401


def test_websocket_accepts_allowed_origin(world):
    c = login("op@ragi.local")
    # TestClient uses ws:// so it won't attach the Secure cookie by itself; pass it explicitly.
    cookie = f"ragi_session={c.cookies.get('ragi_session')}"
    with c.websocket_connect("/ws/operations", headers={"origin": ORIGIN, "cookie": cookie}) as ws:
        c.post("/api/v1/clients", json={"name": "Live Co"})
        msg = ws.receive_json()
        assert msg["action"] == "client.created"


def test_production_refuses_insecure_settings():
    with pytest.raises(ValueError, match="Refusing to start"):
        Settings(app_env="production", database_url=None, cookie_secure=False, _env_file=None)
    with pytest.raises(ValueError, match="PostgreSQL"):
        Settings(app_env="production", database_url="sqlite:///x.db", field_encryption_key="k", api_docs_enabled=False,
                 _env_file=None)
    ok = Settings(app_env="production", database_url="postgresql+psycopg://u:p@db/ragi", field_encryption_key="k",
                  api_docs_enabled=False, _env_file=None)
    assert ok.cookie_secure is True


def test_dev_defaults_are_safe():
    s = Settings(_env_file=None, app_env="development")
    assert s.cookie_secure is True and s.agents_enabled is False and s.repository_writes_enabled is False
    assert s.db_url.startswith("sqlite")


def test_security_headers_present(world):
    r = login("op@ragi.local").get("/api/v1/projects")
    assert r.headers["x-frame-options"] == "DENY" and r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["cache-control"] == "no-store"


def test_login_requires_anti_csrf_header(world):
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app, base_url="https://testserver")
    r = c.post("/api/v1/auth/login", json={"email": "x@ragi.local", "password": "whatever-123"})
    assert r.status_code == 403


def test_health_does_not_leak_environment():
    from fastapi.testclient import TestClient
    from app.main import app
    assert TestClient(app).get("/health").json() == {"status": "ok"}


def test_money_input_is_strict_per_currency():
    import pytest as _pytest
    from app.core.money import MoneyError, parse_strict
    assert str(parse_strict("1000", "RWF")) == "1000" and str(parse_strict("10.5", "PLN")) == "10.50"
    for bad, cur in [("10.50", "RWF"), ("1.234", "PLN"), ("-1", "USD"), ("NaN", "EUR"), ("1", "GBP")]:
        with _pytest.raises(MoneyError):
            parse_strict(bad, cur)
