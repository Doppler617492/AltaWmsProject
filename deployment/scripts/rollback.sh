#!/usr/bin/env bash
set -euo pipefail

SERVER="root@46.224.54.239"
REMOTE_DIR="/opt/alta-wms"
COMPOSE_FILE="deployment/docker-compose.prod.yml"
LOGFILE="/var/log/alta-wms-rollback.log"

timestamp() {
  date "+%F %T"
}

echo "$(timestamp) - Initiating rollback to last stable tag" | tee -a "${LOGFILE}"

ssh "${SERVER}" bash -c "'
  set -euo pipefail
  cd \"${REMOTE_DIR}\"
  git fetch --tags
  LAST_TAG=\$(git describe --tags --abbrev=0 || echo \"main\")
  git checkout \"\${LAST_TAG}\"
  docker compose -f \"${COMPOSE_FILE}\" up -d --build
  docker compose -f \"${COMPOSE_FILE}\" ps
'"

echo "$(timestamp) - Rollback completed" | tee -a "${LOGFILE}"

