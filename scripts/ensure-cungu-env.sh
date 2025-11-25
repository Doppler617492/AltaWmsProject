#!/bin/bash
# Script to ensure CUNGU environment variables are present in .env file
# This prevents the variables from being lost after container restarts

set -e

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found"
    exit 1
fi

# Check if CUNGU variables exist
if grep -q "CUNGU_API_ENABLED" "$ENV_FILE"; then
    echo "✅ CUNGU variables already present in $ENV_FILE"
    exit 0
fi

echo "⚠️  CUNGU variables missing. Adding them now..."

# Add CUNGU variables
cat >> "$ENV_FILE" << 'EOF'

# Cungu/Pantheon Integration
CUNGU_API_ENABLED=true
CUNGU_API_URL=http://cungu.pantheonmn.net:3003
CUNGU_API_USERNAME=CunguWMS
CUNGU_API_PASSWORD=C!g#2W4s5#$$M6
CUNGU_SYNC_PAGE_SIZE=500
CUNGU_SHIPPING_METHOD=GetIssueDocWMS
EOF

echo "✅ CUNGU variables added to $ENV_FILE"
echo ""
echo "Verify with: grep CUNGU $ENV_FILE"
