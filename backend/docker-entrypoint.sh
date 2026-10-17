#!/bin/sh
set -eu

cd /app
./node_modules/.bin/prisma db push
exec "$@"
