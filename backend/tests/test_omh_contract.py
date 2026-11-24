"""Contract test: RAGI's side of the RAGI ⇄ OMH budget-reservation contract.

Schemas are vendored in ragi/contracts/ from ecosystem-contracts/schemas/ (the source of truth).
If the shared folder is present next to the repo, the vendored copy must match it byte for byte.
"""
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from app.integrations.omh.client import parse_reservation_response, reservation_request

VENDORED = Path(__file__).resolve().parents[2] / "contracts"
SHARED = Path(__file__).resolve().parents[3] / "ecosystem-contracts" / "schemas"
NAMES = ["money.schema.json", "budget-reservation-request.schema.json", "budget-reservation-response.schema.json",
         "finance-summary.schema.json", "event.schema.json"]


def _validator(name: str) -> Draft202012Validator:
    resources = []
    for n in NAMES:
        doc = json.loads((VENDORED / n).read_text())
        resources += [(n, Resource.from_contents(doc)), (doc["$id"], Resource.from_contents(doc))]
    registry = Registry().with_resources(resources)
    return Draft202012Validator(json.loads((VENDORED / name).read_text()), registry=registry)


@pytest.mark.skipif(not SHARED.exists(), reason="shared ecosystem-contracts folder not present")
@pytest.mark.parametrize("name", NAMES)
def test_vendored_schemas_match_shared(name):
    assert (VENDORED / name).read_bytes() == (SHARED / name).read_bytes(), f"re-vendor {name}"


@pytest.mark.parametrize("provider", ["openai", "xai", "tbd"])
def test_request_body_matches_contract(provider):
    body = reservation_request(agent_id="forge", project_id="2day-movies", run_id="run-1",
                               estimated_cost={"amount": "2.00", "currency": "USD"}, provider=provider)
    errors = list(_validator("budget-reservation-request.schema.json").iter_errors(body))
    assert not errors, [e.message for e in errors]
    assert "data" not in body and "event_type" not in body  # flat, not an envelope


def test_request_with_float_amount_is_rejected_by_contract():
    body = reservation_request(agent_id="forge", project_id=None, run_id="r", estimated_cost={"amount": 2.0, "currency": "USD"})
    assert list(_validator("budget-reservation-request.schema.json").iter_errors(body))


OMH_201 = {"id": "res-1", "reservation_id": "res-1", "budget_id": "b1", "purpose": "agent_run", "agent_id": "forge",
           "external_ref": "run-1", "amount": {"amount": "2.00", "minor": 200, "currency": "USD"}, "status": "active",
           "period": "2026-11", "created_at": "2026-11-24T23:30:00+00:00", "settled_usage_id": None}


def test_omh_201_example_matches_contract_and_is_granted():
    assert not list(_validator("budget-reservation-response.schema.json").iter_errors(OMH_201))
    d = parse_reservation_response(201, OMH_201)
    assert d.available and d.reservation_id == "res-1"


@pytest.mark.parametrize("code,body", [
    (409, {"detail": "Estimate exceeds available AI budget"}),
    (201, {**OMH_201, "status": "released"}),
    (201, {"status": "active"}),            # missing reservation_id
    (422, {"detail": "bad body"}),
    (500, {}),
])
def test_anything_else_is_denied(code, body):
    assert not parse_reservation_response(code, body).available
