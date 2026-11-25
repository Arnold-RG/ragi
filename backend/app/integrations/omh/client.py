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


def reserve_budget(*, agent_id: str, project_id: str | None, run_id: str, estimated_cost: dict | None = None,
                   provider: str = "other") -> BudgetDecision:
    s = get_settings()
    if estimated_cost is None:
        return BudgetDecision(False, "No cost estimate yet (provider pricing is TBD), so no budget is requested")
    if not s.omh_api_url:
        return BudgetDecision(False, "OMH is not connected, so no budget can be reserved")
    try:
        assert_safe_service_url(s.omh_api_url)
        body = json.dumps(reservation_request(agent_id=agent_id, project_id=project_id, run_id=run_id,
                                              estimated_cost=estimated_cost, provider=provider),
                          separators=(",", ":")).encode()
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


@dataclass
class FinanceSummary:
    """OMH-attributed finance snapshot. Never invent amounts here."""

    status: str  # ok | unlinked | not_configured | asleep | error
    detail: str
    payload: dict | None = None


def fetch_summary(*, organization_id: str = "arnovagroup", timeout: float = 8.0) -> FinanceSummary:
    """GET OMH /api/v1/finance-summary (signed empty body, scope finance:read)."""
    s = get_settings()
    if not s.omh_api_url:
        return FinanceSummary("not_configured", "OMH is not connected")
    try:
        assert_safe_service_url(s.omh_api_url)
        headers = signed_headers(b"")
    except AuthFailure as exc:
        return FinanceSummary("not_configured", f"OMH is not connected: {exc}")
    url = f"{s.omh_api_url.rstrip('/')}/api/v1/finance-summary"
    try:
        r = httpx.get(url, params={"organization_id": organization_id}, headers=headers, timeout=timeout)
    except httpx.TimeoutException:
        return FinanceSummary("asleep", "Our Money Hub is asleep or still starting. Try again in a minute.")
    except httpx.HTTPError:
        return FinanceSummary("asleep", "Our Money Hub is asleep or unreachable. Try again in a minute.")
    if r.status_code in {408, 425, 429, 500, 502, 503, 504}:
        return FinanceSummary("asleep", "Our Money Hub is asleep or still starting. Try again in a minute.")
    if r.status_code != 200:
        return FinanceSummary("error", f"Our Money Hub declined the summary ({r.status_code})")
    try:
        data = r.json()
    except ValueError:
        return FinanceSummary("error", "Our Money Hub returned a response that could not be read")
    if not isinstance(data, dict):
        return FinanceSummary("error", "Our Money Hub returned a response that could not be read")
    if data.get("linked") is False:
        return FinanceSummary("unlinked", data.get("note") or "No OMH workspace is linked yet.", data)
    return FinanceSummary("ok", data.get("note") or "Amounts are per currency and are never added together.", data)

