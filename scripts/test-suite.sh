#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PROJECTS=(
  "backend"
  "frontend-admin"
  "frontend-pwa"
  "frontend-tv"
)

echo "Running lint+tests for Alta WMS projects"

for project in "${PROJECTS[@]}"; do
  PROJECT_PATH="$ROOT/$project"
  SCRIPTS_JSON="$PROJECT_PATH/package.json"
  if [[ ! -f "$SCRIPTS_JSON" ]]; then
    echo "Skipping $project (no package.json)"
    continue
  fi

  echo
  echo "=== $project ==="
  has_lint=$(node -e "const p=require('$PROJECT_PATH/package.json'); console.log(p.scripts && p.scripts.lint ? '1' : '')")
  if [[ -n "$has_lint" ]]; then
    npm --prefix "$PROJECT_PATH" run lint
    echo "✔ lint passed for $project"
  else
    echo "● no lint script for $project, skipping"
  fi

  has_test=$(node -e "const p=require('$PROJECT_PATH/package.json'); console.log(p.scripts && p.scripts.test ? '1' : '')")
  if [[ -n "$has_test" ]]; then
    npm --prefix "$PROJECT_PATH" run test
    echo "✔ tests passed for $project"
  else
    echo "● no test script for $project, skipping"
  fi
done

echo
echo "All requested lint/test commands finished."

