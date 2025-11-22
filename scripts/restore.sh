#!/bin/bash

# Alta WMS Restore Script
# Usage: ./scripts/restore.sh <backup_file.sql.gz> [uploads_backup.tar.gz]

set -e

if [ $# -lt 1 ]; then
    echo "Usage: ./scripts/restore.sh <db_backup.sql.gz> [uploads_backup.tar.gz]"
    exit 1
fi

DB_BACKUP=$1
UPLOADS_BACKUP=$2
COMPOSE_FILE="docker-compose.prod.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}WARNING: This will restore database from backup!${NC}"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Check if backup file exists
if [ ! -f "$DB_BACKUP" ]; then
    echo -e "${RED}✗ Backup file not found: $DB_BACKUP${NC}"
    exit 1
fi

# Restore database
echo -e "${YELLOW}Restoring database from $DB_BACKUP...${NC}"
gunzip < $DB_BACKUP | docker compose -f $COMPOSE_FILE exec -T db psql -U wms_user -d wms

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database restored successfully${NC}"
else
    echo -e "${RED}✗ Database restore failed${NC}"
    exit 1
fi

# Restore uploads if provided
if [ -n "$UPLOADS_BACKUP" ]; then
    if [ ! -f "$UPLOADS_BACKUP" ]; then
        echo -e "${RED}✗ Uploads backup file not found: $UPLOADS_BACKUP${NC}"
    else
        echo -e "${YELLOW}Restoring uploads from $UPLOADS_BACKUP...${NC}"
        tar -xzf $UPLOADS_BACKUP -C .
        echo -e "${GREEN}✓ Uploads restored successfully${NC}"
    fi
fi

echo -e "${GREEN}Restore completed!${NC}"
echo -e "${YELLOW}You may need to restart services: docker compose -f $COMPOSE_FILE restart${NC}"

