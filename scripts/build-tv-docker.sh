#!/bin/bash
set -e

SERVER="$1"
if [ -z "$SERVER" ]; then
  echo "Usage: $0 <server-ip>"
  exit 1
fi

echo "Building TV frontend on $SERVER..."

# Connect and build
ssh -o StrictHostKeyChecking=no root@$SERVER << 'EOF'
cd /opt/alta-wms

# Aggressive cache clearing
echo "Clearing all caches..."
rm -rf /root/.npm /root/.cache/next-swc /tmp/npm-* /tmp/.npm-* 2>/dev/null || true
docker builder prune -af > /dev/null

# Full system memory clear
sync && echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true

echo "Building image..."
cd /opt/alta-wms

# Build with increased retries in container
docker run --rm \
  -e npm_config_fetch_retries=10 \
  -e npm_config_fetch_retry_mintimeout=30000 \
  -e npm_config_fetch_retry_maxtimeout=180000 \
  -e NEXT_TELEMETRY_DISABLED=1 \
  -v /opt/alta-wms/frontend-tv:/app \
  -w /app \
  node:18-bullseye-slim \
  bash -c "npm install --frozen-lockfile && npm run build"

echo "Build successful!"
EOF

echo "Done!"
