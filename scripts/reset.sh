#!/usr/bin/env bash
set -euo pipefail

echo "[reset] Bringing stack down and removing volumes (this wipes DB!)"
docker compose down -v
echo "[reset] Rebuilding and starting services"
docker compose up -d --build
echo "[reset] Waiting a few seconds for backend to boot…"
sleep 6
docker compose ps
echo "[reset] Done. If backend isn't ready yet, check logs: make logs"

