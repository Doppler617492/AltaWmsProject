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
  echo "[users-demo] Failed to obtain admin token. Ensure backend is up and admin/admin works."
  exit 1
fi

auth() { echo "Authorization: Bearer $TOKEN"; }

create_user() {
  local FULL="$1" USER="$2" PASS="$3" ROLE="$4" SHIFT="$5"
  echo "[users-demo] Ensuring user $USER ($ROLE)"
  curl -s -X POST "$API/users" -H "$(auth)" -H 'Content-Type: application/json' \
    -d "{\"full_name\":\"$FULL\",\"username\":\"$USER\",\"password\":\"$PASS\",\"role\":\"$ROLE\",\"shift\":\"$SHIFT\"}" >/dev/null || true
}

create_user "Šef Skladišta" sef admin sef PRVA
create_user "Menadžer Skladišta" menadzer admin menadzer PRVA
create_user "Marko Radnik" marko marko123 magacioner PRVA

echo "[users-demo] Done. Open admin (:3000) → KORISNICI to verify."

