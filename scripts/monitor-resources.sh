ccl#!/usr/bin/env bash
set -euo pipefail

LOGFILE="monitor.log"
INTERVAL=5

echo "Monitoring resource usage every ${INTERVAL}s (Ctrl+C to stop)" | tee "${LOGFILE}"

while true; do
  DATE=$(date '+%Y-%m-%d %H:%M:%S')
  echo "---- ${DATE} ----" | tee -a "${LOGFILE}"
  echo "Top 5 memory consumers:" | tee -a "${LOGFILE}"
  ps -axo pid,rss,comm | sort -rn -k2 | head -n 10 | tee -a "${LOGFILE}"
  echo "Chrome/Safari sockets:" | tee -a "${LOGFILE}"
  pgrep -f "Chrome" | xargs -r ps -o pid,rss,comm | tee -a "${LOGFILE}"
  pgrep -f "Safari" | xargs -r ps -o pid,rss,comm | tee -a "${LOGFILE}"
  echo "Node/WebSocket stats:" | tee -a "${LOGFILE}"
  ps -Ao pid,rss,comm | grep -E "node|io" | head -n 10 | tee -a "${LOGFILE}"
  if [[ -f "monitor.log" ]]; then
    echo "" | tee -a "${LOGFILE}"
  fi
  sleep "${INTERVAL}"
done

