# RAGI

Owner-only private secretary. **Public code. Private locks and secrets.**

- **Web root (GitHub Pages):** [`web/`](./web/)
- **Secure backend (32GB-class host):** [`backend/`](./backend/) — see [`backend/ARCHITECTURE.md`](./backend/ARCHITECTURE.md)
- **Docker stack (Postgres + Redis + API):** [`docker-compose.yml`](./docker-compose.yml)

### Backend layers

`bootstrap` → `shared` (db/crypto/vault) → `modules` (auth, secretary, calendar, ai)

### Database

- Local: SQLite at `backend/prisma/data/ragi.db`
- Production: PostgreSQL via Docker

## Security model

1. Passphrase (Argon2id)
2. TOTP **or** immutable owner backup code
3. Device key **or** WebAuthn passkey

Sessions are JWT + server-side session rows. Vault fields use AES-256-GCM. Audit log records every auth and AI call. Rate limits and lockouts apply.

## Local backend (Windows)

```powershell
cd backend
copy .env.example .env
# fill RAGI_MASTER_KEY, RAGI_SESSION_SECRET, OWNER_* , optional GEMINI_API_KEY
npm install
npx prisma db push
npm run seed
npm run dev
```

Health: http://127.0.0.1:8787/health

## 32GB host

Node starts with `--max-old-space-size=28672` in Docker / `npm run start`.  
Postgres `shared_buffers=4GB`, Redis `maxmemory 4gb`. Memory is **capacity**, not pre-allocated waste.

## Credits

Arnova Group · Arnold-RG

## License

Private product logic with a public repository shell. Do not commit `.env`, keys, or personal exports.
