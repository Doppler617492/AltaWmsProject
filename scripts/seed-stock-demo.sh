#!/usr/bin/env bash
set -euo pipefail

FILE="scripts/stock-demo.sql"
if [ ! -f "$FILE" ]; then
  echo "[seed-stock-demo] Missing $FILE" >&2
  exit 1
fi

echo "[seed-stock-demo] Applying demo stock/movements SQL"
docker exec -i alta-wms-db psql -U wms_user -d wms < "$FILE"
echo "[seed-stock-demo] Done"

