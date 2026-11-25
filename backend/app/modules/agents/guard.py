"""Safety guard every agent dispatch passes through (spec §07 safety/).

Order: emergency stop → agent enabled → provider configured → capability →
owner approval. Every check is recorded on the run as evidence.
"""
from dataclasses import asdict, dataclass

from app.core.config import get_settings
from app.integrations.providers.base import provider_status
from app.modules.agents.models import Agent


@dataclass
class Check:
    name: str
    passed: bool
    detail: str


def evaluate(agent: Agent, *, capability: str | None, run_id: str, project_slug: str | None,
             owner_approved: bool) -> list[dict]:
    s = get_settings()
    checks: list[Check] = [
        Check("emergency_stop", s.agents_enabled,
              "AGENTS_ENABLED=true" if s.agents_enabled else "AGENTS_ENABLED is false — every agent is stopped"),
        Check("agent_enabled", agent.enabled, "Agent enabled by owner" if agent.enabled else "Agent is disabled"),
    ]
    ps = provider_status(agent.provider)
    checks.append(Check("provider_connected", ps.configured, ps.detail))
    if capability:
        ok = capability in (agent.capabilities or [])
        checks.append(Check("capability", ok, f"{'Has' if ok else 'Lacks'} capability {capability}"))
    if (agent.governance or {}).get("owner_approval_required", True):
        checks.append(Check("owner_approval", owner_approved,
                            "Owner approved" if owner_approved else "Waiting for owner approval"))
    return [asdict(c) for c in checks]
