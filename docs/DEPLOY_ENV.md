# Environment values for RAGI and Our Money Hub

Free-tier hosting only: Render free web services and Neon free Postgres. No extra disks or paid workers. GitHub sync can run in-process on the RAGI API. The two apps are standalone and do not call each other.

Secrets must be collected with a private secret-request card, never pasted in chat. Client IDs and public URLs can be given in the open.

## arnova-ragi (frontend)

| Variable | Secret? | Value |
|---|---|---|
| `RAGI_API_ORIGIN` | no | `https://arnova-ragi-api.onrender.com` |

## arnova-ragi-api

| Variable | Secret? | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon connection string (already set) |
| `MIGRATE_DATABASE_URL` | yes | Neon connection string (already set) |
| `FIELD_ENCRYPTION_KEY` | yes | Already generated |
| `GITHUB_SYNC_TOKEN` | yes | Fine-grained personal access token, read-only, for `Arnold-RG` repository metadata. Leave empty to keep Sync from GitHub off. |
| `GITHUB_SYNC_INTERVAL_HOURS` | no | `0` (off) or `6` for an in-process refresh every six hours |
| `GITHUB_SYNC_INCLUDE_PRIVATE` | no | `false` unless the private office and archive repos should appear |

## arnova-omh (frontend)

| Variable | Secret? | Value |
|---|---|---|
| `OMH_API_INTERNAL_URL` | no | `https://arnova-omh-api.onrender.com` |

## arnova-omh-api

| Variable | Secret? | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon connection string (already set) |
| `MIGRATE_DATABASE_URL` | yes | Neon connection string (already set) |
| `OMH_SECRET_KEY` | yes | Already generated |

