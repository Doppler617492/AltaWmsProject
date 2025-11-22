#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/alta-wms"
COMPOSE_FILE="${REPO_DIR}/docker-compose.yml"

cd "$REPO_DIR"

echo "Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo "Pulling images..."
docker compose -f "$COMPOSE_FILE" pull

if [[ " $* " == *" --build "* ]]; then
  echo "Rebuilding containers..."
  docker compose -f "$COMPOSE_FILE" up -d --build
else
  echo "Starting containers..."
  docker compose -f "$COMPOSE_FILE" up -d
fi

echo "Running backend migrations..."
# TODO: replace with actual migration command, e.g. `docker compose -f "$COMPOSE_FILE" exec backend npm run migrate`

echo "Health check..."
# TODO: add actual health-check command, e.g. `curl -f http://localhost/health`
