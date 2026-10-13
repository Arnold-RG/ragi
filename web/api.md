# RAGI web ↔ backend map

Default API: `VITE_API_ORIGIN` (local `http://127.0.0.1:8787`)

| UI action | Backend |
|-----------|---------|
| Unlock gate 1–3 | `POST /api/v1/auth/challenge` + `/gate/1|2|3` |
| Session restore | `GET /api/v1/auth/me` |
| Logout | `POST /api/v1/auth/logout` |
| Work / Personal | `GET|PUT /api/v1/mode` |
| Dawn scroll | `GET /api/v1/briefing` |
| Quest log | `GET|POST /api/v1/jobs` |
| Focus block | `GET|POST /api/v1/focus` |
| H-01 HOME / charts | `GET /api/v1/dashboard` |
| F-33 FORGE | `GET|POST|PATCH /api/v1/projects` · `/goals` · `/activities` |
| G-55 GOLD | `GET|POST /api/v1/finance` |
| C-88 CLOCK | `/meetings` · `/reminders` · `/emergencies` |
| CAST / Hey Ragi | `POST /api/v1/ai/chat` (Gemini if key set, else local vault brain) |
| Storage status / snapshots | `GET /api/v1/storage/status` · `/snapshots` · `POST /snapshot` |
| Export / restore (merge) | `GET /api/v1/storage/export` · `POST /api/v1/storage/restore` |
| Edit / soft-delete | `PATCH` + `DELETE` on projects, goals, activities, finance, meetings, reminders, emergencies, notes, jobs |
| GitHub hub | `GET /api/v1/github/repos` · `PUT /api/v1/github/progress` |
| API pill | `GET /health` |

DELETE soft-archives after a vault snapshot — rows stay in the DB.

Mic jump is local Web Audio → amber scribe sprite.
