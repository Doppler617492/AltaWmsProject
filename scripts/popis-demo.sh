#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:8000}"

get_token() {
  local USERNAME="$1" PASSWORD="$2"
  if command -v jq >/dev/null 2>&1; then
    curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" | jq -r .token
  else
    curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
  fi
}

TOKEN="$(get_token admin admin)"
if [ -z "${TOKEN}" ] || [ "${TOKEN}" = "null" ]; then
  echo "[popis-demo] Failed to obtain admin token. Ensure backend is up and admin/admin works."
  exit 1
fi

auth() { echo "Authorization: Bearer $TOKEN"; }

TARGET_CODE="${TARGET_CODE:-1A001001}"
ASSIGN_USER="${ASSIGN_USER:-marko}"

echo "[popis-demo] Creating demo cycle count for LOKACIJA $TARGET_CODE"
curl -s -X POST "$API/cycle-count/task" -H "$(auth)" -H 'Content-Type: application/json' \
  -d "{\"scope\":\"LOKACIJA\",\"target_code\":\"$TARGET_CODE\"}" >/dev/null

echo "[popis-demo] Done. Open ZALIHE → Popis to verify."
