#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
( cd "$ROOT/backend" && uv run pytest )
( cd "$ROOT/frontend" && npm run typecheck && npx eslint src && npm test )
