from datetime import date

from sqlalchemy import select

from app.events.models import EventOutbox
from app.modules.time_tracking.models import TimeEntry
from tests.conftest import login


def _project(c, world, **kw):
    body = {"name": "Kigali booking site", "client_id": world.client_a.id, "status": "active", "hourly_rate": "25000",
            "currency": "RWF", **kw}
    r = c.post("/api/v1/projects", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_project_crud_and_progress_from_tasks(world, db):
    c = login("op@ragi.local")
    p = _project(c, world)
    t1 = c.post("/api/v1/tasks", json={"title": "Design", "project_id": p["id"]}).json()
    c.post("/api/v1/tasks", json={"title": "Build", "project_id": p["id"]})
    c.patch(f"/api/v1/tasks/{t1['id']}", json={"status": "done"})
    got = c.get(f"/api/v1/projects/{p['id']}").json()
    assert got["task_total"] == 2 and got["task_done"] == 1 and got["progress"] == 50
    assert db.scalar(select(EventOutbox).where(EventOutbox.event_type == "project.created"))


def test_viewer_cannot_write(world):
    c = login("viewer@ragi.local")
    assert c.get("/api/v1/projects").status_code == 200
    assert c.post("/api/v1/projects", json={"name": "Nope"}).status_code == 403


def test_cross_org_project_invisible(world):
    p = _project(login("op@ragi.local"), world)
    assert login("op@other.local").get(f"/api/v1/projects/{p['id']}").status_code == 404


def test_lead_pipeline_and_conversion(world):
    c = login("op@ragi.local")
    lead = c.post("/api/v1/leads", json={"name": "Aline", "company": "Kivu Lodge", "estimated_amount": "1800000",
                                         "currency": "RWF"}).json()
    assert lead["estimated_amount"] == "1800000"
    assert c.patch(f"/api/v1/leads/{lead['id']}", json={"stage": "won"}).status_code == 422
    c.patch(f"/api/v1/leads/{lead['id']}", json={"stage": "proposal"})
    won = c.post(f"/api/v1/leads/{lead['id']}/convert", json={"project_name": "Kivu Lodge website"}).json()
    assert won["stage"] == "won" and won["project_id"] and won["client_id"]
    assert c.post(f"/api/v1/leads/{lead['id']}/convert", json={"project_name": "again"}).status_code == 409


def test_pipeline_values_never_summed_across_currencies(world):
    c = login("op@ragi.local")
    c.post("/api/v1/leads", json={"name": "Lead A", "estimated_amount": "1000", "currency": "RWF"})
    c.post("/api/v1/leads", json={"name": "Lead B", "estimated_amount": "10.50", "currency": "PLN"})
    v = c.get("/api/v1/dashboard/summary").json()["pipeline"]["value_by_currency"]
    assert v == {"RWF": "1000", "PLN": "10.50"}


def test_timer_start_stop_and_single_running(world):
    c = login("op@ragi.local")
    p = _project(c, world)
    e = c.post("/api/v1/time-entries/start", json={"project_id": p["id"]}).json()
    assert e["running"] is True
    assert c.post("/api/v1/time-entries/start", json={"project_id": p["id"]}).status_code == 409
    stopped = c.post(f"/api/v1/time-entries/{e['id']}/stop").json()
    assert stopped["running"] is False and stopped["minutes"] >= 1


def test_invoice_request_from_time_prevents_double_billing(world, db):
    c = login("op@ragi.local")
    p = _project(c, world)
    c.post("/api/v1/time-entries", json={"project_id": p["id"], "minutes": 90})
    c.post("/api/v1/time-entries", json={"project_id": p["id"], "minutes": 30, "billable": False})
    inv = c.post("/api/v1/billing-handoffs/invoices/from-time", json={"project_id": p["id"]}).json()
    assert inv["draft_total"] == "37500" and inv["currency"] == "RWF"  # 1.5 h × 25,000 RWF
    assert c.post("/api/v1/billing-handoffs/invoices/from-time", json={"project_id": p["id"]}).status_code == 422
    billed = db.scalars(select(TimeEntry).where(TimeEntry.billing_handoff_id == inv["id"])).all()
    assert len(billed) == 1


def test_quote_handoff_needs_owner_approval_then_emits_event(world, db):
    c = login("op@ragi.local")
    q = c.post("/api/v1/billing-handoffs/quotes", json={
        "client_id": world.client_a.id, "title": "Website", "currency": "PLN",
        "lines": [{"description": "Design", "quantity": "1", "unit_amount": "1000.10"},
                  {"description": "Pages", "quantity": "3", "unit_amount": "333.33"}]}).json()
    assert q["draft_total"] == "2000.09" and q["status"] == "draft"
    q = c.post(f"/api/v1/billing-handoffs/{q['id']}/submit").json()
    assert q["status"] == "pending_approval"
    assert c.post(f"/api/v1/approvals/{q['approval_id']}/decide", json={"decision": "approved"}).status_code == 403
    owner = login("owner@ragi.local", world.totp_secret)
    assert owner.post(f"/api/v1/approvals/{q['approval_id']}/decide", json={"decision": "approved"}).status_code == 200
    ev = db.scalar(select(EventOutbox).where(EventOutbox.event_type == "quotation.requested"))
    assert ev.payload["data"]["draft_total"] == {"amount": "2000.09", "currency": "PLN"}
    assert ev.payload["data"]["ragi_handoff_id"] == q["id"]
    assert owner.post(f"/api/v1/approvals/{q['approval_id']}/decide", json={"decision": "approved"}).status_code == 409


def test_rejected_invoice_releases_time(world, db):
    c = login("op@ragi.local")
    p = _project(c, world)
    c.post("/api/v1/time-entries", json={"project_id": p["id"], "minutes": 60})
    inv = c.post("/api/v1/billing-handoffs/invoices/from-time", json={"project_id": p["id"]}).json()
    inv = c.post(f"/api/v1/billing-handoffs/{inv['id']}/submit").json()
    login("owner@ragi.local", world.totp_secret).post(f"/api/v1/approvals/{inv['approval_id']}/decide",
                                                     json={"decision": "rejected"})
    assert db.scalar(select(TimeEntry).where(TimeEntry.billing_handoff_id.is_not(None))) is None


def test_retainer_usage_warning(world):
    c = login("op@ragi.local")
    r = c.post("/api/v1/retainers", json={"client_id": world.client_a.id, "name": "Care", "hours_per_month": 2,
                                          "monthly_fee": "100000", "currency": "RWF",
                                          "starts_on": date.today().isoformat()}).json()
    p = _project(c, world, retainer_id=r["id"])
    c.post("/api/v1/time-entries", json={"project_id": p["id"], "minutes": 100})
    got = c.get("/api/v1/retainers").json()[0]
    assert got["used_minutes"] == 100 and got["usage_state"] == "warning" and got["monthly_fee"] == "100000"


def test_portal_user_sees_only_own_client(world):
    c = login("op@ragi.local")
    _project(c, world, name="A site")
    _project(c, world, name="B site", client_id=world.client_b.id)
    portal = login("portal@ragi.local")
    ov = portal.get("/api/v1/portal/overview").json()
    assert [p["name"] for p in ov["projects"]] == ["A site"]
    for path in ["/api/v1/projects", "/api/v1/tasks", "/api/v1/time-entries", "/api/v1/agents", "/api/v1/clients"]:
        assert portal.get(path).status_code == 403
    assert c.get("/api/v1/portal/overview").status_code == 403


def test_audit_log_owner_only(world, as_owner):
    assert login("op@ragi.local").get("/api/v1/audit-logs").status_code == 403
    assert as_owner.get("/api/v1/audit-logs").status_code == 200


def test_search_scoped(world):
    _project(login("op@ragi.local"), world, name="Secret Lake project")
    assert login("op@other.local").get("/api/v1/search?q=Secret").json()["results"] == []
