#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/mnt/storagebox/backups"
UPLOADS_DIR="/opt/alta-wms/uploads"
LOGFILE="/var/log/alta-wms-restore.log"

timestamp() {
  date "+%F %T"
}

if [ $# -lt 1 ]; then
  echo "Usage: $0 <uploads-archive.tar.gz>" | tee -a "${LOGFILE}"
  exit 1
fi

ARCHIVE="$1"

if [ ! -f "${ARCHIVE}" ]; then
  echo "$(timestamp) - Archive ${ARCHIVE} not found" | tee -a "${LOGFILE}"
  exit 1
fi

mkdir -p "${UPLOADS_DIR}"

echo "$(timestamp) - Restoring uploads from ${ARCHIVE}" | tee -a "${LOGFILE}"
tar -xzf "${ARCHIVE}" -C "${UPLOADS_DIR}"
echo "$(timestamp) - Uploads restored to ${UPLOADS_DIR}" | tee -a "${LOGFILE}"

