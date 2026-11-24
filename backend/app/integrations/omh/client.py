"""OMH (Our Money Hub) client — the financial authority for budgets.

ONE contract, shared with the OMH builder (ecosystem-contracts/openapi/ecosystem-api.yaml,
schemas/budget-reservation-request.schema.json and budget-reservation-response.schema.json):
  POST {OMH_API_URL}/api/v1/budget-reservations
    auth:  X-Arnova-Key-Id / X-Arnova-Timestamp / X-Arnova-Signature (RAGI's own rotating key,
           scope "budget:reserve"); no user JWT, no shared static secret.
    body:  FLAT ReservationRequest — {agent_id, run_id, project_id, provider, estimated_cost, source:"ragi"}
           (OMH's ServiceReserveIn, unchanged).
    reply: 201 Reservation {reservation_id, status:"active", amount, ...}  -> granted
           409 {"detail": str}                                             -> denied
    Idempotent on run_id. Settle/release: POST .../{reservation_id}/settle|release, signed the same way.
    Anything else is treated as denied (fail closed).
RAGI never reads OMH's database and never stores money amounts as truth.
"""
import json
from dataclasses import dataclass

import httpx

from app.core.config import get_settings
from app.core.service_auth import AuthFailure, assert_safe_service_url, signed_headers


PROVIDERS = {"openai", "xai", "anthropic", "google", "other"}


@dataclass
class BudgetDecision:
    available: bool
    reason: str
    reservation_id: str | None = None


def reservation_request(*, agent_id: str, project_id: str | None, run_id: str,
                        estimated_cost: dict, provider: str = "other") -> dict:
    """The flat ReservationRequest body (see ecosystem-contracts/schemas)."""
    return {"agent_id": agent_id, "run_id": run_id, "project_id": project_id,
            "provider": provider if provider in PROVIDERS else "other",
            "estimated_cost": estimated_cost, "source": "ragi"}


def parse_reservation_response(status_code: int, data: dict) -> BudgetDecision:
    if status_code == 201 and data.get("status") == "active" and data.get("reservation_id"):
        return BudgetDecision(True, "Budget reserved by OMH", str(data["reservation_id"]))
    if status_code == 409:
        return BudgetDecision(False, f"OMH denied: {data.get('detail', 'over budget')}")
    return BudgetDecision(False, f"OMH declined the reservation ({status_code})")


def reserve_budget(*, agent_id: str, project_id: str | None, run_id: str, estimated_cost: dict | None = None) -> BudgetDecision:
    s = get_settings()
    if estimated_cost is None:
        return BudgetDecision(False, "No cost estimate yet (provider pricing is TBD), so no budget is requested")
    if not s.omh_api_url:
        return BudgetDecision(False, "OMH is not connected, so no budget can be reserved")
    try:
        assert_safe_service_url(s.omh_api_url)
        body = json.dumps(reservation_request(agent_id=agent_id, project_id=project_id, run_id=run_id,
                                              estimated_cost=estimated_cost), separators=(",", ":")).encode()
        headers = signed_headers(body)
    except AuthFailure as exc:
        return BudgetDecision(False, f"OMH call refused: {exc}")
    try:  # pragma: no cover - needs a running OMH
        r = httpx.post(f"{s.omh_api_url.rstrip('/')}/api/v1/budget-reservations", content=body, headers=headers, timeout=5)
    except httpx.HTTPError as exc:  # pragma: no cover
        return BudgetDecision(False, f"OMH unreachable: {exc.__class__.__name__}")
    try:  # pragma: no cover
        data = r.json()
    except ValueError:  # pragma: no cover
        data = {}
    return parse_reservation_response(r.status_code, data if isinstance(data, dict) else {})  # pragma: no cover


def finance_summary() -> dict:
    """GET /api/v1/finance-summary?organization_id=arnovagroup (signed, empty body, finance:read)."""
    s = get_settings()
    if not s.omh_api_url:
        return {"connected": False, "source": "omh",
                "message": "Awaiting verified financial records — OMH is not connected yet."}
    try:
        assert_safe_service_url(s.omh_api_url)
        headers = signed_headers(b"")
    except AuthFailure as exc:
        return {"connected": False, "source": "omh", "message": f"OMH call refused: {exc}"}
    url = f"{s.omh_api_url.rstrip('/')}/api/v1/finance-summary"
    try:
        r = httpx.get(url, params={"organization_id": "arnovagroup"}, headers=headers, timeout=5)
    except httpx.HTTPError as exc:
        return {"connected": False, "source": "omh", "message": f"OMH unreachable ({exc.__class__.__name__})"}
    try:
        data = r.json() if r.content else {}
    except ValueError:
        data = {}
    if r.status_code == 200 and isinstance(data, dict):
        return {"connected": True, "source": "omh", **data}
    detail = data.get("detail") if isinstance(data, dict) else None
    if not isinstance(detail, str) or not detail:
        detail = f"OMH returned {r.status_code}"
    return {"connected": False, "source": "omh", "message": detail}


