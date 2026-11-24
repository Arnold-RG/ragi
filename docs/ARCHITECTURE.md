# RAGI v2 architecture

Created by Arnold Rurangwa / Arnova Group.

```
Browser ──► Next.js 16 (3410) ──/api/* rewrite──► FastAPI (8410) ──► PostgreSQL 17 (55410)
                │  proxy.ts: no session cookie → /login           │
                └─ ws://…:8410/ws/operations (live feed) ◄────────┤
                                                                   ├─► event_outbox ──(signed)──► OMH /api/v1/events
OMH ──(signed, events:write)──► POST /api/v1/events ─► event_inbox ┘
RAGI ──(signed, budget:reserve)──► OMH /api/v1/budget-reservations   (only when agents are enabled)
```

- **Backend:** `app/core` (config, security, crypto, service auth, money), `app/modules/<area>/{models,schemas,service,router}`,
  `app/events` (transactional outbox/inbox, §10 envelope), `app/integrations` (OMH client, AI provider interfaces,
  SSRF-safe HTTP check). Alembic migrations in `migrations/`.
- **Frontend:** App Router with `(auth)`, `(workspace)` and `portal` groups; SWR data fetching through the same-origin
  rewrite (first-party cookie); Tailwind v4 tokens from `arnova-tokens.css`; Motion for transitions (respects reduced motion).
- **Money:** decimal strings on the wire, strict per-currency parsing, never summed across currencies. OMH is the book
  of record; RAGI stores draft totals for requests only.
- **Agents:** guard order emergency stop → agent enabled → provider connected → capability → owner approval →
  OMH budget reserved. Any failure blocks the run and is recorded.
