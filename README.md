# RAGI v2

**The operations engine of the Arnova Group ecosystem.** Created by Arnold Rurangwa / Arnova Group.

RAGI runs the studio path: client pipeline → quotes and invoices prepared for Our Money Hub (OMH) → projects and
Linear-grade tasks → time tracking → owner approvals → retainers → a client portal. It also hosts the governed agent
workforce (Jarvis, Forge, Sentinel, Nova, Mentor), which stays switched off until the owner decides otherwise.

> Status: **local alpha for owner review.** Not deployed, not pushed. Sample data is opt-in and labelled SAMPLE.

## What is in this build

| Area | State |
|---|---|
| Sign-in | Argon2id passwords, opaque HttpOnly session cookie, anti-CSRF header, TOTP two-step (mandatory for owner/admin), encrypted TOTP secrets, lockout after 5 wrong codes / passwords |
| Operations dashboard | Projects, tasks, throughput, pipeline value per currency, time, retainers, agents, approvals, live activity (pausable) |
| Projects & tasks | Board + list, keyboard first (C, /, J/K, [ ], Enter, B), drag between columns, inline status, history, milestones |
| Pipeline & clients | Lead stages new → won/lost; a won lead becomes a client + upcoming project in one step |
| Time & retainers | One running timer, manual entries, billable split; retainer usage from linked projects, warning at 80 % |
| Quotes & invoices | Prepared as *requests*; owner approval hands them to OMH as events. OMH issues the documents (book of record) |
| Agents | Five placeholders, fail-closed guard: emergency stop → enabled → provider → capability → owner approval → OMH budget |
| Client portal | Client-role users see only their own projects, milestones and issued documents |
| Control | Approvals (owner only), audit log, SSRF-safe website checks, reports with formula-safe CSV |

Deferred and owner decisions: see [docs/SPEC_GAPS_TBD.md](docs/SPEC_GAPS_TBD.md).

## Run it locally

Requirements: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 22+, PostgreSQL 17 (SQLite works for development only).

```bash
cp .env.example backend/.env            # then fill in DATABASE_URL, FIELD_ENCRYPTION_KEY, keyring path
cd backend && uv sync && uv run alembic upgrade head
uv run python -m scripts.seed --password-file /secure/path/owner-login.txt   # add --with-demo for SAMPLE data
uv run uvicorn app.main:app --host 127.0.0.1 --port 8410
cd ../frontend && npm ci && npm run build && npm start   # http://localhost:3410
```

Or `scripts/dev.sh` (starts both with nohup and writes logs outside the repo).

| Service | Port |
|---|---|
| Web (Next.js) | **3410** |
| API (FastAPI) | **8410** (`/api/docs` in development only) |
| PostgreSQL | **55410** |

The seed writes the owner's password and TOTP secret only to the `--password-file` you choose (created with mode 600).
Add the secret to an authenticator app, then sign in with email + password + the 6-digit code.

`docker-compose.yml` describes the same stack (db, api, web; redis optional) — see the file header.

## Tests

```bash
scripts/test.sh            # backend pytest + frontend typecheck, lint, vitest
scripts/e2e.sh             # Playwright smoke test against the running stack
scripts/security-scan.sh   # gitleaks + semgrep
```

## Ecosystem contracts

RAGI ⇄ OMH contracts live in the shared `ecosystem-contracts/` folder (vendored here in `contracts/`):
signed requests with per-service rotating keys, the §10 event envelope, the budget-reservation schema and the
finance-summary schema. `backend/tests/test_omh_contract.py` fails if the vendored copies drift.

---
© Arnold Rurangwa / Arnova Group. All rights reserved.
