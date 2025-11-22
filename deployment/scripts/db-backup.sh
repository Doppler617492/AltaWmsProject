#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/mnt/storagebox/backups"
LOGFILE="/var/log/alta-wms-backup.log"

timestamp() {
  date "+%F %T"
}

mkdir -p "${BACKUP_DIR}"

echo "$(timestamp) - Starting database backup" | tee -a "${LOGFILE}"
docker exec -t db pg_dump -U wms_user wms_prod > "${BACKUP_DIR}/db-$(date +%F).sql"
echo "$(timestamp) - Database dump saved to ${BACKUP_DIR}/db-$(date +%F).sql" | tee -a "${LOGFILE}"

