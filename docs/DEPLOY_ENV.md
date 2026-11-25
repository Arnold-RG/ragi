# Environment values for RAGI and Our Money Hub

Free-tier hosting only: Render free web services and Neon free Postgres. No extra disks or paid workers. Delivery and GitHub sync run in-process on the API.

Secrets must be collected with a private secret-request card, never pasted in chat. Client IDs and public URLs can be given in the open.

## arnova-ragi (frontend)

| Variable | Secret? | Value |
|---|---|---|
| `RAGI_API_ORIGIN` | no | `https://arnova-ragi-api.onrender.com` |
| `NEXT_PUBLIC_OMH_URL` | no | `https://arnova-omh.onrender.com` |

## arnova-ragi-api

| Variable | Secret? | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon connection string (already set) |
| `MIGRATE_DATABASE_URL` | yes | Neon connection string (already set) |
| `FIELD_ENCRYPTION_KEY` | yes | Already generated |
| `OMH_API_URL` | no | `https://arnova-omh-api.onrender.com` |
| `ECOSYSTEM_SIGNING_KEY_ID` | no | The RAGI key id in the shared keyring, for example `ragi-2026-11` |
| `ECOSYSTEM_KEYRING_JSON` | yes | The full keyring JSON. RAGI's key needs scopes `budget:reserve`, `events:write` and `finance:read`. OMH's key needs `events:write`. |
| `GITHUB_SYNC_TOKEN` | yes | Fine-grained personal access token, read-only, for `Arnold-RG` repository metadata. Leave empty to keep Sync from GitHub off. |
| `GITHUB_SYNC_INTERVAL_HOURS` | no | `0` (off) or `6` for an in-process refresh every six hours |
| `GITHUB_SYNC_INCLUDE_PRIVATE` | no | `false` unless the private office and archive repos should appear |

## arnova-omh (frontend)

| Variable | Secret? | Value |
|---|---|---|
| `OMH_API_INTERNAL_URL` | no | `https://arnova-omh-api.onrender.com` |
| `NEXT_PUBLIC_RAGI_URL` | no | `https://arnova-ragi.onrender.com` |

## arnova-omh-api

| Variable | Secret? | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon connection string (already set) |
| `MIGRATE_DATABASE_URL` | yes | Neon connection string (already set) |
| `OMH_SECRET_KEY` | yes | Already generated |
| `RAGI_API_URL` | no | `https://arnova-ragi-api.onrender.com` |
| `ECOSYSTEM_SIGNING_KEY_ID` | no | The OMH key id, for example `omh-2026-11` |
| `ECOSYSTEM_KEYRING_JSON` | yes | The same keyring JSON as RAGI (both services need both keys) |
| `OMH_RAGI_WORKSPACE_ID` | no | The OMH workspace id created after owner setup. Set this so RAGI can read the finance summary and reserve budgets. |

The two frontends keep separate accounts and sessions. “Open in Money Hub” and the RAGI switcher only open the other site.

A typical keyring looks like this (never use these placeholder secrets):

```json
{"keys":[
  {"kid":"ragi-2026-11","service":"ragi","secret":"generate-a-long-random-string","scopes":["budget:reserve","events:write","finance:read"]},
  {"kid":"omh-2026-11","service":"omh","secret":"generate-another-long-random-string","scopes":["events:write"]}
]}
```
