# RAGI

A private secretary. **Public house. Private vaults.**

Anyone may create an account. Notes, money, projects, and snapshots stay on that account, encrypted, and are not readable by anyone else. The owner's account is an account like any other: no shared back door.

Live chamber: https://arnold-rg.github.io/ragi/

- **Web:** [`web/`](./web/) — Vite + TypeScript · Pages at `/ragi/`
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

Accounts sign in with email and a password of at least 12 characters. Passwords are hashed with Argon2id and are never stored or logged in the clear. A legacy triple seal (passphrase, authenticator or backup code, device key or passkey) still opens the original seeded account if you run `npm run seed`.

Sessions are a signed JWT plus a server-side session row that can be revoked. The browser keeps the token in `sessionStorage` for this tab. Vault fields use AES-256-GCM with a salt that belongs to that account. Queries are scoped by account id. Snapshots are per account and are never a copy of the whole database. Auth routes are rate limited, and repeated failures lock the address and the email for a while. Audit log records sign-in and AI calls.

The Pages site is the house. It does not contain anyone's vault. Set `VITE_API_ORIGIN` to your API host before the Pages build if visitors should be able to sign up there. Until that variable is set, the public page still opens and will say the vault link is down.

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

Create an account in the vault. You do not need the seed script for a normal account. `npm run seed` is only for the legacy triple-seal owner, and it refuses to overwrite an existing one.

CORS allows local Vite (`4173`) and `https://arnold-rg.github.io`.

## Publish (public live link)

Live chamber: **https://arnold-rg.github.io/ragi/**

The static chamber is built from [`web/`](./web/) by [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) on every push to `main` that touches `web/`. The workflow also refreshes the [`gh-pages`](https://github.com/Arnold-RG/ragi/tree/gh-pages) branch with the built site.

### One-time GitHub Pages enable (required)

A repo admin must flip this once (the Actions token cannot create the Pages site by itself):

1. Open **Settings → Pages → Build and deployment**.
2. Prefer **Source: Deploy from a branch**, branch **`gh-pages`**, folder **`/ (root)`**, then **Save**.
   - Or choose **Source: GitHub Actions** if you want the Actions Pages environment instead.
3. Wait about a minute, then open https://arnold-rg.github.io/ragi/

Optional: under **About** on the repo, set the website URL to that link.

### Wire the vault API (optional)

Until an API is hosted, the public page still opens; sign-up/sign-in will say the vault link is down.

1. Host the API over HTTPS (Docker stack or any Node host). Generate `RAGI_MASTER_KEY` and `RAGI_SESSION_SECRET` there — do not commit them.
2. Set `RAGI_WEB_ORIGIN` so it includes `https://arnold-rg.github.io`.
3. In the repository, add variable `VITE_API_ORIGIN` with the public API origin (e.g. `https://api.example.com`). Re-run the Pages workflow.

`robots.txt` and `sitemap.xml` ship with the Pages build under `/ragi/`. GitHub serves a project site on that path, not at the domain root.

## 32GB host

Node starts with `--max-old-space-size=28672` in Docker / `npm run start`.  
Postgres `shared_buffers=4GB`, Redis `maxmemory 4gb`. Memory is **capacity**, not pre-allocated waste.

## Credits

Arnova Group · Arnold-RG

## License

Private product logic with a public repository shell. Do not commit `.env`, keys, or personal exports.
