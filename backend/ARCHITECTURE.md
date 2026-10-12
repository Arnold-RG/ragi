# RAGI backend architecture

## Database — yes

| Environment | Engine | Location |
|-------------|--------|----------|
| Local / seed | **SQLite** | `backend/prisma/data/ragi.db` |
| Production (Docker) | **PostgreSQL 16** | `docker-compose.yml` service `postgres` |
| Hot cache | Redis 7 (optional) or in-process memory | `REDIS_URL` |

Prisma schema: `prisma/schema.prisma`  
Sensitive fields (notes, jobs, OAuth, briefing cache, audit details) are **AES-256-GCM** encrypted with a per-owner vault salt.

## Layer map

```text
src/
  server.ts              # process entry, graceful shutdown
  app.ts                 # Fastify factory
  bootstrap/
    plugins.ts           # security middleware, CORS, rate limit, errors, request-id
    routes.ts            # single route registry (order + alignment)
  shared/
    config.ts            # env validation
    db.ts                # Prisma client
    crypto.ts            # Argon2id + AES-GCM
    vault.ts             # owner encrypt/decrypt helper
    redis.ts             # Redis or budgeted memory cache
    logger.ts / memory.ts / errors.ts
    security/audit.ts
  modules/
    health/              # /health /ready
    system/              # architecture + owner status
    auth/                # triple gates, sessions, webauthn
    secretary/           # mode, briefing, jobs, focus, notes, export
      routes.ts          # thin HTTP
      service.ts         # business logic
    calendar/            # Google + Microsoft OAuth + events
    ai/                  # Gemini proxy
  scripts/               # seed, reseed, smoke, healthcheck
```

## Request flow

1. `bootstrap/plugins` — helmet, cookies, CORS, rate limit, request id  
2. Module route matches `/api/v1/...`  
3. `requireOwner` (triple seal) for private routes  
4. Module `service` uses `shared/db` + `shared/vault`  
5. Audit + response  

## Capacity (32GB-class host)

- Node heap target: `RAGI_HEAP_MB=28672`  
- Cache budget: `RAGI_CACHE_BUDGET_MB=4096`  
- Postgres / Redis tuned in `docker-compose.yml`  
Memory is **allocated on demand**, not pre-filled.

## Recommended next additions

1. **Prisma migrations** (`prisma migrate`) instead of only `db push`  
2. **Encrypted DB backups** cron (SQLite file or `pg_dump`)  
3. **Background worker** for calendar sync + briefing refresh  
4. **Metrics** (`/metrics` Prometheus) + structured audit export  
5. **Refresh-token rotation** for Google/Microsoft  
6. **Integration tests** for the three gates + secretary service  
7. **Deploy API** on Fly/VPS (Pages hosts `web/` only)  
8. Wire chamber UI to these module endpoints  
