# Security — RAGI v2

Created by Arnold Rurangwa / Arnova Group.

Report a vulnerability privately to the owner. Do not open a public issue.

## Controls in this build
- **Passwords:** Argon2id. Lockout after 5 failures for 15 minutes; emails are case-insensitive.
- **Sessions:** opaque random tokens stored as SHA-256 hashes; `HttpOnly`, `Secure`, `SameSite=Lax` cookie;
  every cookie-authenticated write — including sign-in — needs the `X-RAGI-Request: 1` header.
- **Two-step sign-in:** TOTP, mandatory for owner and admin (an un-enrolled owner can only enrol or sign out);
  secrets encrypted at rest (Fernet, `FIELD_ENCRYPTION_KEY`); 5 wrong codes lock the account and revoke the session;
  a code cannot be replayed.
- **Authorisation:** role permissions (owner, admin, operator, viewer, client); every query is scoped to the
  organisation; approvals are owner-only and row-locked.
- **Service-to-service:** per-service rotating HMAC keys with scopes, validity windows and a ±300 s timestamp
  window; envelope `source` must equal the key's service; HTTPS only (loopback HTTP in development).
- **WebSocket:** Origin allow-list, session re-validated on every poll, organisation-scoped.
- **SSRF:** website checks resolve and pin public IPs only (blocks private, CGNAT 100.64/10, loopback, link-local,
  multicast, reserved, IPv4-mapped/6to4), re-validate every redirect (max 5), refuse credentials in URLs.
- **Exports:** CSV cells starting with `= + - @`, tab, CR (or full-width forms) are neutralised.
- **Money:** decimal strings on the wire; input rejected if it has more decimals than the currency allows.
- **Configuration guard:** outside development the API refuses to start without PostgreSQL, secure cookies,
  an encryption key and disabled API docs.
- **Safety switches:** `AGENTS_ENABLED`, `REPOSITORY_WRITES_ENABLED`, `PRODUCTION_DEPLOYMENT_ENABLED` default off.

## Known gaps (tracked)
- No per-IP sign-in rate limit yet; per-account lockout can be abused to lock the owner out temporarily.
- No Content-Security-Policy yet on the web app.
- Account recovery is a stub until an email provider is chosen.
