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
  echo "[seed-shifts] Failed to obtain admin token. Ensure backend is up and admin/admin works."
  exit 1
fi

auth() { echo "Authorization: Bearer $TOKEN"; }

fetch_user_id() {
  local USERNAME="$1"
  if command -v jq >/dev/null 2>&1; then
    curl -s -H "$(auth)" "$API/users" | jq -r ".[] | select(.username==\"$USERNAME\") | .id" | head -n1
  else
    # naive fallback: look for "username":"<name>", then backtrack to previous "id":<num>
    curl -s -H "$(auth)" "$API/users" | tr '\n' ' ' | sed 's/},/},\n/g' | grep "\"username\":\"$USERNAME\"" | sed -n 's/.*\"id\":\([0-9][0-9]*\).*/\1/p' | head -n1
  fi
}

assign_shift() {
  local UID="$1" TYPE="$2"
  echo "[seed-shifts] Assigning $TYPE to user_id=$UID"
  curl -s -X POST "$API/workforce/shift-assign" -H "$(auth)" -H 'Content-Type: application/json' \
    -d "{\"user_id\":$UID,\"shift_type\":\"$TYPE\"}" >/dev/null
}

MAGA_ID="$(fetch_user_id magacioner || true)"
MARKO_ID="$(fetch_user_id marko || true)"

if [ -n "$MAGA_ID" ]; then assign_shift "$MAGA_ID" PRVA; fi
if [ -n "$MARKO_ID" ]; then assign_shift "$MARKO_ID" DRUGA; fi

echo "[seed-shifts] Done. You can verify via: curl -H '$(auth)' $API/workforce/overview"

