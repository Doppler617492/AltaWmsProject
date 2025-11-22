#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/mnt/storagebox/backups"
UPLOADS_DIR="/opt/alta-wms/uploads"
LOGFILE="/var/log/alta-wms-backup.log"

timestamp() {
  date "+%F %T"
}

mkdir -p "${BACKUP_ROOT}"

echo "$(timestamp) - Starting manual backup" | tee -a "${LOGFILE}"

ARCHIVE="${BACKUP_ROOT}/uploads-$(date +%F-%H%M%S).tar.gz"
if [ -d "${UPLOADS_DIR}" ]; then
  tar -czf "${ARCHIVE}" -C "${UPLOADS_DIR}" .
  echo "$(timestamp) - Uploads archived to ${ARCHIVE}" | tee -a "${LOGFILE}"
else
  echo "$(timestamp) - Uploads directory ${UPLOADS_DIR} not found" | tee -a "${LOGFILE}"
fi

bash "$(dirname "${BASH_SOURCE[0]}")/db-backup.sh"

echo "$(timestamp) - Manual backup complete" | tee -a "${LOGFILE}"

