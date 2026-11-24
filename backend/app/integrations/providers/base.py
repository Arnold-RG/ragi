"""AI execution providers (OpenAI, xAI). Interface only this round.

No provider call is made anywhere in RAGI v2 yet: every dispatch is stopped by
the safety guard first. Implementations must record usage and report it to OMH
as `agent.usage.recorded` events.
"""
from dataclasses import dataclass
from typing import Protocol

from app.core.config import get_settings


@dataclass
class ProviderStatus:
    provider: str
    configured: bool
    detail: str


class ExecutionProvider(Protocol):
    name: str

    def status(self) -> ProviderStatus: ...

    def execute(self, *, agent_id: str, prompt: str, max_cost_minor_units: int) -> dict:
        """Run one sandboxed step. Must raise if budget or permissions are missing."""
        ...


class _KeyProvider:
    name = "base"
    env_var = ""

    def status(self) -> ProviderStatus:
        key = getattr(get_settings(), self.env_var.lower(), None)
        return ProviderStatus(self.name, bool(key),
                              "API key present (execution not enabled in this build)" if key else f"{self.env_var} not set")

    def execute(self, *, agent_id: str, prompt: str, max_cost_minor_units: int) -> dict:  # pragma: no cover
        raise NotImplementedError("Provider execution is deferred until the owner approves AI spending limits")


class OpenAIProvider(_KeyProvider):
    name = "openai"
    env_var = "OPENAI_API_KEY"


class XAIProvider(_KeyProvider):
    name = "xai"
    env_var = "XAI_API_KEY"


PROVIDERS: dict[str, ExecutionProvider] = {"openai": OpenAIProvider(), "xai": XAIProvider()}


def provider_status(name: str) -> ProviderStatus:
    if name == "tbd":
        return ProviderStatus(name, False, "Provider not chosen yet (owner decision)")
    p = PROVIDERS.get(name)
    return p.status() if p else ProviderStatus(name, False, "Unknown provider")
