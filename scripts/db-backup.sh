#!/usr/bin/env bash
set -euo pipefail

OUTDIR="${1:-backups}"
mkdir -p "$OUTDIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUTDIR/wms-$STAMP.sql"

echo "[db-backup] Creating dump to $FILE"
docker exec -i alta-wms-db pg_dump -U wms_user -d wms > "$FILE"
echo "[db-backup] Done"

