#!/bin/bash
cd /opt/alta-wms
# Remove all CUNGU lines
sed -i '/CUNGU/d' .env
# Add correct variables
cat >> .env << 'ENVEOF'

# Cungu/Pantheon API Integration
CUNGU_API_ENABLED=true
CUNGU_API_URL=http://cungu.pantheonmn.net:3003
CUNGU_API_USERNAME=CunguWMS
CUNGU_API_PASSWORD=C!g#2W4s5#$$M6
CUNGU_SYNC_PAGE_SIZE=500
CUNGU_SHIPPING_METHOD=GetIssueDocWMS
ENVEOF

# Recreate backend with new env
docker compose -f docker-compose.prod.yml up -d --force-recreate backend
