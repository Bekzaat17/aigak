#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo 'Install and start Docker Desktop first.' >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo 'Start Docker Desktop first.' >&2; exit 1; }
if [ ! -e .env ]; then
  umask 077
  password=$(docker run --rm --entrypoint sh postgres:18 -c "od -An -N24 -tx1 /dev/urandom | tr -d ' \n'")
  printf 'PORT=4317\nDATA_DIR=./data\nPOSTGRES_PASSWORD=%s\nDATABASE_URL=postgres://aigak:%s@127.0.0.1:5432/aigak\n' "$password" "$password" > .env
fi
docker compose build api
docker compose up -d --wait --wait-timeout 180
echo 'Aigak is ready: http://localhost:4317 (or the PORT configured in .env).'
