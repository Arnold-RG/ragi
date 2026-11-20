#!/usr/bin/env python3
"""Fail CI when a RAGI Compose service publishes a host port beyond loopback.

Usage: docker compose config --format json | python3 scripts/check-compose-boundary.py
This is a static exposure check, not a runtime firewall or authorization audit.
"""
import json
import sys

ALLOWED_HOSTS = {"127.0.0.1", "::1"}
EXPECTED_SERVICES = {"postgres", "redis", "api", "web"}


def check(config):
    errors = []
    services = config.get("services", {})
    for name in sorted(EXPECTED_SERVICES - set(services)):
        errors.append(f"Expected Compose service missing: {name}")

    for service_name, service in services.items():
        for port in service.get("ports", []) or []:
            host_ip = port.get("host_ip", "") if isinstance(port, dict) else ""
            if host_ip not in ALLOWED_HOSTS:
                errors.append(
                    f"{service_name} publishes a non-loopback port "
                    f"(host_ip={host_ip!r}): {port!r}"
                )
    return errors


def main():
    try:
        config = json.load(sys.stdin)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        print(f"Cannot read normalized Compose JSON: {exc}", file=sys.stderr)
        return 2

    errors = check(config)
    if errors:
        for message in errors:
            print(f"SECURITY CHECK FAILED: {message}", file=sys.stderr)
        return 1
    print("Compose published ports are loopback-only.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
