#!/usr/bin/env bash
# Start Postgres + Neo4j in Docker, then run registry, evault-core, and dev-sandbox locally.
# Run from repo root. Requires: docker, pnpm, .env (see QUICKSTART.md).

set -e
cd "$(dirname "$0")/.."

# Load .env so services get DB URLs and secrets
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . ./.env
  set +a
fi

echo "Starting Postgres + Neo4j (docker)..."
docker compose -f docker-compose.databases.yml up -d

echo "Waiting for Postgres (in container)..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if docker compose -f docker-compose.databases.yml exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" 2>/dev/null; then
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "Postgres did not become ready in time."
    exit 1
  fi
  sleep 2
done

echo "Waiting for Postgres on host port 5432 (so registry can connect)..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if (echo >/dev/tcp/127.0.0.1/5432) 2>/dev/null || nc -z 127.0.0.1 5432 2>/dev/null; then
    break
  fi
  if [ "$i" -eq 12 ]; then
    echo "Port 5432 is not reachable from host. Is Docker running and postgres mapped to 5432?"
    exit 1
  fi
  sleep 2
done
echo "Waiting for Neo4j on host port 7687..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if (echo >/dev/tcp/127.0.0.1/7687) 2>/dev/null || nc -z 127.0.0.1 7687 2>/dev/null; then
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "Port 7687 (Neo4j) not reachable yet. Starting apps anyway; evault-core will retry."
  fi
  sleep 2
done
echo "Postgres and Neo4j are up."

echo "Starting registry, evault-core, dev-sandbox (logs prefixed by service)..."
pnpm exec concurrently -n registry,evault,sandbox \
  "pnpm --filter registry dev" \
  "pnpm --filter evault-core dev" \
  "pnpm --filter dev-sandbox dev"
