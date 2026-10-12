# RAGI web ↔ backend map

Default API: `VITE_API_ORIGIN` (local `http://127.0.0.1:8787`)

| UI action | Backend |
|-----------|---------|
| Unlock gate 1–3 | `POST /api/v1/auth/challenge` + `/gate/1|2|3` |
| Session restore | `GET /api/v1/auth/me` |
| Logout | `POST /api/v1/auth/logout` |
| Work / Home | `GET|PUT /api/v1/mode` |
| Dawn scroll | `GET /api/v1/briefing` |
| Quest log | `GET|POST /api/v1/jobs` |
| Focus block | `GET|POST /api/v1/focus` |
| CAST / Hey Ragi | `POST /api/v1/ai/chat` |
| API pill | `GET /health` |

Mic jump is local Web Audio → amber scribe sprite (no audio leaves the browser except when you CAST text to Gemini).
