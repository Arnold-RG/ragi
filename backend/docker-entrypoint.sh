#!/bin/sh
set -eu

# `docker compose run --rm -u root api chown ...` must not push the schema first.
if [ "${1:-}" != "node" ]; then
  exec "$@"
fi

data=/var/ragi/data
db=$data/ragi.db
backups=$data/backups

deny() {
  echo "run: docker compose run --rm -u root api chown -R node:node /var/ragi/data"
  exit 1
}

# A failed redirect under `set -e` aborts dash before `||` can run.
can_write() {
  (set +e; : > "$1") 2>/dev/null
}

writable_dir() {
  probe="$1/.ragi-write-probe.$$"
  can_write "$probe" || return 1
  rm -f "$probe" || return 1
  return 0
}

if [ ! -d "$data" ] || ! writable_dir "$data"; then
  deny
fi

if [ -e "$db" ]; then
  (set +e; : >> "$db") 2>/dev/null || deny
fi

if [ -d "$backups" ]; then
  writable_dir "$backups" || deny
elif [ -e "$backups" ]; then
  deny
else
  mkdir "$backups" 2>/dev/null || deny
  writable_dir "$backups" || deny
fi

cd /app
./node_modules/.bin/prisma db push
exec "$@"
