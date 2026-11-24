#!/usr/bin/env bash
# Start RAGI locally: API on 8410, web on 3410. Env from $RAGI_ENV_FILE (outside the repo). Logs in $RAGI_RUNTIME.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="${RAGI_RUNTIME:-/workspace/arnova-v2/runtime/ragi}"
ENV_FILE="${RAGI_ENV_FILE:-$RUNTIME/api.env}"
mkdir -p "$RUNTIME"
for port in 8410 3410; do
  pid=$(ss -ltnp 2>/dev/null | grep ":$port " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
  [ -n "${pid:-}" ] && kill "$pid" && sleep 1
done
( cd "$ROOT/backend" && set -a && . "$ENV_FILE" && set +a && uv run alembic upgrade head \
  && setsid nohup uv run uvicorn app.main:app --host 127.0.0.1 --port 8410 > "$RUNTIME/api.log" 2>&1 & )
( cd "$ROOT/frontend" && npm run build > "$RUNTIME/web-build.log" 2>&1 \
  && setsid nohup npm start > "$RUNTIME/web.log" 2>&1 & )
echo "RAGI starting: web http://localhost:3410  api http://127.0.0.1:8410  (logs in $RUNTIME)"
