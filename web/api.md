# RAGI API map (backend)

Base: `http://127.0.0.1:8787` (local) or your API host.

## Public
- `GET /health`
- `GET /ready`
- `POST /api/v1/auth/challenge`
- `POST /api/v1/auth/gate/1`
- `POST /api/v1/auth/gate/2`
- `POST /api/v1/auth/gate/3`
- `POST /api/v1/auth/webauthn/auth-options`
- `GET /api/v1/calendar/google/callback`
- `GET /api/v1/calendar/microsoft/callback`

## Owner session required (triple seal)
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET|PUT /api/v1/mode`
- `GET /api/v1/briefing`
- `GET|POST /api/v1/jobs` · `PATCH /api/v1/jobs/:id`
- `GET|POST /api/v1/focus` · `POST /api/v1/focus/:id/complete`
- `GET|POST /api/v1/notes`
- `GET /api/v1/export`
- `GET /api/v1/calendar/status`
- `GET /api/v1/calendar/google/start`
- `GET /api/v1/calendar/microsoft/start`
- `GET /api/v1/calendar/events?provider=google|microsoft`
- `POST /api/v1/ai/chat`
- WebAuthn register options/verify

All sensitive note/job/focus/OAuth fields are AES-256-GCM encrypted at rest with a per-owner vault salt.
