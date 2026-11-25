"""NOM group: RAGI must not expose money fields, finance-summary, or finance:read."""
from tests.conftest import login


MONEY_KEYS = {
    "hourly_rate", "monthly_fee", "estimated_amount", "draft_total", "unit_amount",
    "by_currency", "value_by_currency", "amount", "amount_minor", "currency",
    "planned_cost", "funded_so_far", "budget", "over_budget",
}


def _walk(obj, path=""):
    hits = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in MONEY_KEYS:
                hits.append(f"{path}.{k}" if path else k)
            hits.extend(_walk(v, f"{path}.{k}" if path else k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            hits.extend(_walk(v, f"{path}[{i}]"))
    return hits


def test_nom_02_dashboard_and_projects_have_no_money(world):
    c = login("op@ragi.local")
    summary = c.get("/api/v1/dashboard/summary").json()
    assert "omh" not in summary
    assert _walk(summary) == []
    p = c.post("/api/v1/projects", json={"name": "No-money project"}).json()
    assert _walk(p) == []
    listed = c.get("/api/v1/projects").json()
    assert _walk(listed) == []


def test_nom_n01_finance_summary_is_not_a_ragi_book(world):
    """RAGI does not expose a book-of-record /finance-summary. The OMH snapshot lives under /integrations/omh/summary."""
    c = login("op@ragi.local")
    assert c.get("/api/v1/finance-summary").status_code == 404
    r = c.get("/api/v1/integrations/omh/summary")
    assert r.status_code == 200
    assert r.json()["source"] == "omh"


def test_nom_03_summary_helper_fails_closed():
    from app.integrations.omh.client import fetch_summary
    result = fetch_summary()
    assert result.status in {"not_configured", "asleep"}
    assert result.payload is None


def test_showcase_has_no_money_and_lists_arnold_rg_repos(world):
    c = login("op@ragi.local")
    data = c.get("/api/v1/showcase/sites").json()
    assert "Arnold-RG" in data["subtitle"]
    assert "public repos" not in data["subtitle"].lower()
    assert data["sites"]
    assert _walk(data) == []
    assert any(not s["embeddable"] and "twodaymovie.onrender.com" in (s.get("live_url") or "") for s in data["sites"])


def test_future_projects_have_no_budget_fields(world):
    c = login("op@ragi.local")
    r = c.post("/api/v1/future-projects", json={"name": "New bike", "target_date": "2027-05-31"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "New bike"
    assert body["open_in_money_hub"] is True
    assert "budget" not in str(body).lower()
    assert "over_budget" not in body
    assert _walk(body) == []
