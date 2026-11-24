"""Per-service, rotating, scoped credentials for RAGI ⇄ OMH (and other services).

Contract: ecosystem-contracts/docs/authentication.md

The keyring is a JSON file outside the repository (ECOSYSTEM_KEYRING_FILE):
  {"keys": [
     {"kid": "omh-2026-11", "service": "omh", "secret": "...", "scopes": ["events:write"],
      "not_before": "2026-11-01T00:00:00Z", "not_after": "2027-02-01T00:00:00Z"},
     {"kid": "ragi-2026-11", "service": "ragi", "secret": "...", "scopes": ["budget:reserve", "events:write"], ...}
  ]}
Each service has its OWN key(s). Rotation = add the new kid, switch the signer, retire the old kid
after its not_after. Requests carry X-Arnova-Key-Id, X-Arnova-Timestamp and X-Arnova-Signature.
"""
import hmac
import json
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import get_settings
from app.core.security import sign_body


@dataclass
class ServiceKey:
    kid: str
    service: str
    secret: str
    scopes: list[str] = field(default_factory=list)
    not_before: datetime | None = None
    not_after: datetime | None = None

    def active(self, now: datetime) -> bool:
        return (self.not_before is None or now >= self.not_before) and (self.not_after is None or now < self.not_after)


class AuthFailure(Exception):
    pass


def _dt(v: str | None) -> datetime | None:
    return datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None


def load_keyring(path: str | None = None) -> dict[str, ServiceKey]:
    path = path or get_settings().ecosystem_keyring_file
    if not path or not Path(path).exists():
        return {}
    raw = json.loads(Path(path).read_text())
    keys = {}
    for k in raw.get("keys", []):
        if len(k.get("secret", "")) < 32:
            raise ValueError(f"Key {k.get('kid')} secret is too short (min 32 chars)")
        keys[k["kid"]] = ServiceKey(k["kid"], k["service"], k["secret"], list(k.get("scopes", [])),
                                    _dt(k.get("not_before")), _dt(k.get("not_after")))
    return keys


def verify_request(headers, body: bytes, *, scope: str, keyring: dict[str, ServiceKey] | None = None,
                   now: float | None = None) -> ServiceKey:
    keyring = load_keyring() if keyring is None else keyring
    if not keyring:
        raise AuthFailure("Service authentication is not configured")
    kid = headers.get("x-arnova-key-id")
    ts = headers.get("x-arnova-timestamp")
    sig = headers.get("x-arnova-signature")
    if not kid or not ts or not sig:
        raise AuthFailure("Missing service authentication headers")
    key = keyring.get(kid)
    current = now if now is not None else time.time()
    if not key or not key.active(datetime.fromtimestamp(current, UTC)):
        raise AuthFailure("Unknown or expired key")
    try:
        ts_val = int(ts)
    except ValueError as exc:
        raise AuthFailure("Bad timestamp") from exc
    if abs(current - ts_val) > get_settings().ecosystem_max_clock_skew_seconds:
        raise AuthFailure("Timestamp outside the allowed window")
    if not hmac.compare_digest(sign_body(key.secret, ts, body), sig):
        raise AuthFailure("Invalid signature")
    if scope not in key.scopes:
        raise AuthFailure(f"Key lacks scope {scope}")
    return key


def signed_headers(body: bytes) -> dict[str, str]:
    s = get_settings()
    keyring = load_keyring()
    key = keyring.get(s.ecosystem_signing_key_id or "")
    if not key or key.service != "ragi" or not key.active(datetime.now(UTC)):
        raise AuthFailure("No active RAGI signing key")
    ts = str(int(time.time()))
    return {"X-Arnova-Key-Id": key.kid, "X-Arnova-Timestamp": ts, "X-Arnova-Signature": sign_body(key.secret, ts, body),
            "Content-Type": "application/json"}


def assert_safe_service_url(url: str) -> None:
    """Refuse plain http:// except to loopback in development."""
    u = urlparse(url)
    if u.scheme == "https":
        return
    if u.scheme == "http" and get_settings().is_development and u.hostname in {"127.0.0.1", "localhost", "::1"}:
        return
    raise AuthFailure("OMH_API_URL must use https:// (http allowed only for localhost in development)")
