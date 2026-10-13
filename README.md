# RAGI

Owner-only private secretary. **Public code. Private locks and secrets.**

Dark-age CRT chamber in the browser, Fastify vault on the wire. Three gates before anything opens.

- **Web (CRT UI):** [`web/`](./web/) — Vite + TypeScript · Pages at `/ragi/`
- **Rooms:** Vault · Hall · **Home** · Forge · Gold · Clock · **Hub (GitHub %)** · Map · Den
- **Backend:** [`backend/`](./backend/) — see [`backend/ARCHITECTURE.md`](./backend/ARCHITECTURE.md)
- **Stack:** [`docker-compose.yml`](./docker-compose.yml) — Postgres · Redis · API · optional nginx web
- **Route map:** [`web/api.md`](./web/api.md)

CAST uses Gemini when `GEMINI_API_KEY` is set; otherwise the **local vault secretary** answers from your real projects, finance, meetings, and goals (no more dead signal).

### Durable vault storage

- Live data: SQLite at `backend/prisma/data/ragi.db` (or Postgres volume in Docker)
- Memory snapshots: append-only JSON + DB copies under `backend/prisma/data/backups/`
- Every write schedules a snapshot; **E-77 DEN** can seal, export, and merge-restore
- `npm run reseed` is blocked unless `RAGI_ALLOW_WIPE=YES` — code changes never erase vault data
- Owner seals stay immutable; restore only **merges** rows

### Layers

`bootstrap` → `shared` (db/crypto/vault) → `modules` (auth, secretary, calendar, ai) · `web` talks only to `/api/v1/*` + `/health`

### Database

- Local: SQLite at `backend/prisma/data/ragi.db`
- Production: PostgreSQL via Docker

## Security model

1. Passphrase (Argon2id)
2. TOTP **or** immutable owner backup code
3. Device key **or** WebAuthn passkey

Sessions are JWT + server-side session rows. Vault fields use AES-256-GCM. Audit log records every auth and AI call. Rate limits and lockouts apply.

## Local full stack (Windows)

```powershell
# Terminal 1 — API
cd backend
copy .env.example .env
# fill RAGI_MASTER_KEY, RAGI_SESSION_SECRET, OWNER_* (quote OWNER_PASSPHRASE if it contains #), optional GEMINI_API_KEY
npm install
npx prisma db push
npm run seed
npm run dev

# Terminal 2 — CRT chamber
cd web
copy .env.example .env
npm install
npm run dev
```

- API health: http://127.0.0.1:8787/health  
- Chamber: http://127.0.0.1:4173/  
- Docker all-in-one web: http://127.0.0.1:8080/ (after `docker compose up --build`)

CORS allows local Vite (`4173`) and `https://arnold-rg.github.io`. Set repo variable `VITE_API_ORIGIN` for Pages builds that should hit your public API host.

## 32GB host

Node starts with `--max-old-space-size=28672` in Docker / `npm run start`.  
Postgres `shared_buffers=4GB`, Redis `maxmemory 4gb`. Memory is **capacity**, not pre-allocated waste.

## Credits

Arnova Group · Arnold-RG

## License

Private product logic with a public repository shell. Do not commit `.env`, keys, or personal exports.
