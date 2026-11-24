#!/usr/bin/env bash
# Secret scan (gitleaks) and static analysis (semgrep). Exit non-zero on findings.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
gitleaks detect --source . -c .gitleaks.toml --no-banner --redact ${GITLEAKS_ARGS:---no-git}
semgrep scan --config p/python --config p/typescript --config p/react --config p/secrets \
  --exclude node_modules --exclude .next --exclude .venv --exclude screenshots --error --quiet
