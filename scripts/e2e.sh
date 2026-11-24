#!/usr/bin/env bash
# Run the Playwright smoke test against the local stack (web :3410, API :8410).
# Reads the seeded owner's credentials from the 0600 runtime file into the environment only.
set -euo pipefail
CREDS="${RAGI_CREDS_FILE:-/workspace/arnova-v2/runtime/ragi/owner-login.txt}"
export RAGI_E2E_EMAIL="$(grep -m1 '^\[owner\] email=' "$CREDS" | sed 's/.*email=\([^ ]*\).*/\1/')"
export RAGI_E2E_PASSWORD="$(grep -m1 '^\[owner\] email=' "$CREDS" | sed 's/.*password=//')"
export RAGI_E2E_TOTP_SECRET="$(grep -m1 'totp_secret=' "$CREDS" | sed 's/.*totp_secret=\([^ ]*\).*/\1/')"
cd "$(dirname "$0")/../frontend"
mkdir -p e2e/.auth
exec npx playwright test "$@"
