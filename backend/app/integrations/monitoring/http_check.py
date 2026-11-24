"""Owner-triggered availability check with SSRF protection.

- Only http(s); every hop of a redirect chain is re-validated (max 5 hops).
- The host is resolved once and the request is sent to that exact, validated IP
  (Host header + TLS SNI keep the original name), which defeats DNS rebinding.
- Only globally routable addresses are allowed: loopback, private, link-local,
  carrier-grade NAT (100.64/10), unspecified, reserved, multicast and
  IPv4-mapped/6to4 forms of those are refused.
"""
import ipaddress
import socket
import time
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse, urlunparse

import httpx

MAX_REDIRECTS = 5


@dataclass
class CheckResult:
    status: str
    status_code: int | None
    response_ms: int | None
    error: str | None = None


class UnsafeTarget(ValueError):
    pass


def is_public_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped:
            return is_public_ip(ip.ipv4_mapped)
        if ip.sixtofour:
            return is_public_ip(ip.sixtofour)
    return ip.is_global and not (ip.is_multicast or ip.is_unspecified or ip.is_reserved or ip.is_loopback or ip.is_link_local)


def resolve_public(url: str) -> tuple[str, str]:
    """Validate the URL and return (hostname, one validated public IP)."""
    u = urlparse(url)
    if u.scheme not in {"http", "https"} or not u.hostname:
        raise UnsafeTarget("Only http(s) URLs can be checked")
    if u.username or u.password:
        raise UnsafeTarget("Credentials in URLs are not allowed")
    try:
        infos = socket.getaddrinfo(u.hostname, u.port or (443 if u.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UnsafeTarget("Host does not resolve") from exc
    ips = {info[4][0] for info in infos}
    if not ips:
        raise UnsafeTarget("Host does not resolve")
    for ip in ips:
        if not is_public_ip(ipaddress.ip_address(ip)):
            raise UnsafeTarget("Private or internal addresses are not allowed")
    return u.hostname, sorted(ips)[0]


def assert_public_url(url: str) -> None:
    resolve_public(url)


def _pinned_request(client: httpx.Client, url: str) -> httpx.Response:
    host, ip = resolve_public(url)
    u = urlparse(url)
    ip_host = f"[{ip}]" if ":" in ip else ip
    netloc = ip_host + (f":{u.port}" if u.port else "")
    pinned = urlunparse((u.scheme, netloc, u.path or "/", u.params, u.query, ""))
    host_header = host + (f":{u.port}" if u.port else "")
    return client.get(pinned, headers={"Host": host_header, "User-Agent": "RAGI-Monitor/2.0 (Arnova Group)"},
                      extensions={"sni_hostname": host} if u.scheme == "https" else {})


def check(url: str, timeout: float = 8.0, *, requester=None) -> CheckResult:
    resolve_public(url)
    start = time.perf_counter()
    current = url
    try:
        with httpx.Client(timeout=timeout, follow_redirects=False) as client:
            send = requester or (lambda u: _pinned_request(client, u))
            for _ in range(MAX_REDIRECTS + 1):
                r = send(current)
                if r.is_redirect and r.headers.get("location"):
                    current = urljoin(current, r.headers["location"])
                    resolve_public(current)  # re-validate every hop
                    continue
                break
            else:
                return CheckResult("down", None, None, "Too many redirects")
    except UnsafeTarget:
        raise
    except httpx.HTTPError as exc:
        return CheckResult("down", None, None, exc.__class__.__name__)
    ms = int((time.perf_counter() - start) * 1000)
    if r.status_code >= 500:
        status = "down"
    elif r.status_code >= 400 or ms > 3000:
        status = "degraded"
    else:
        status = "up"
    return CheckResult(status, r.status_code, ms)
