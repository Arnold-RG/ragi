# RAGI

A private secretary. **No login wall on the public site** — press Enter RAGI and the on-device workspace opens.

Notes, money, projects, and GitHub intel stay on the visitor’s device (IndexedDB). An optional durable API remains in [`backend/`](./backend/) for self-hosted seals.

Live chamber: https://arnold-rg.github.io/ragi/

- **Web:** [`web/`](./web/) — Vite + Three.js cinematic desk · Pages at `/ragi/`
- **Rooms:** Welcome · Hall · **Home** · Forge · Gold · Clock · **Hub (GitHub %)** · Map · Den
- **Backend:** [`backend/`](./backend/) — see [`backend/ARCHITECTURE.md`](./backend/ARCHITECTURE.md)
- **Stack:** [`docker-compose.yml`](./docker-compose.yml) — Postgres · Redis · API · optional nginx web
- **Route map:** [`web/api.md`](./web/api.md)

CAST uses Gemini when `GEMINI_API_KEY` is set; otherwise the **local secretary** answers from real projects, finance, meetings, and goals.

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

## Publish

The chamber is deployed from [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) to GitHub Pages on every push to `main` that touches `web/`.

1. In the repository, open **Settings → Pages → Build and deployment** and choose **GitHub Actions**. The workflow also asks to enable Pages itself. If the run still reports that Pages is missing, that settings switch is the one that has to be flipped by hand.
2. Host the API somewhere reachable over HTTPS (the Docker stack, or any Node host). Generate `RAGI_MASTER_KEY` and `RAGI_SESSION_SECRET` on that host. Do not commit them.
3. Set `RAGI_WEB_ORIGIN` so it includes `https://arnold-rg.github.io`.
4. In the repository, add a variable `VITE_API_ORIGIN` with the public API origin, for example `https://api.example.com`. Re-run the Pages workflow. Vite bakes that origin into the static build.
5. The live URL is https://arnold-rg.github.io/ragi/

`robots.txt` and `sitemap.xml` ship with the Pages build under `/ragi/`. GitHub serves a project site on that path, not at the domain root.

## 32GB host

Node starts with `--max-old-space-size=28672` in Docker / `npm run start`.  
Postgres `shared_buffers=4GB`, Redis `maxmemory 4gb`. Memory is **capacity**, not pre-allocated waste.

## Credits

Arnova Group · Arnold-RG

## License

Private product logic with a public repository shell. Do not commit `.env`, keys, or personal exports.
