#!/usr/bin/env bash
set -euo pipefail

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Usage: $0 backups/<dump.sql>" >&2
  exit 1
fi

echo "[db-restore] Restoring from $FILE"
cat "$FILE" | docker exec -i alta-wms-db psql -U wms_user -d wms
echo "[db-restore] Done"

