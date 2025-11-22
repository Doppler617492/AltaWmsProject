#!/bin/bash

# Alta WMS Backup Script
# Usage: ./scripts/backup.sh

set -e

BACKUP_DIR="/opt/alta-wms/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
COMPOSE_FILE="docker-compose.prod.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting backup process...${NC}"

# Kreiraj backup direktorijum ako ne postoji
mkdir -p $BACKUP_DIR
mkdir -p $BACKUP_DIR/logs

# Backup baze podataka
echo -e "${YELLOW}Backing up database...${NC}"
docker compose -f $COMPOSE_FILE exec -T db pg_dump -U wms_user wms | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database backup completed: db_backup_$DATE.sql.gz${NC}"
    DB_SIZE=$(du -h $BACKUP_DIR/db_backup_$DATE.sql.gz | cut -f1)
    echo "  Size: $DB_SIZE"
else
    echo -e "${RED}✗ Database backup failed!${NC}"
    exit 1
fi

# Backup uploads direktorijuma
echo -e "${YELLOW}Backing up uploads...${NC}"
if [ -d "uploads" ] && [ "$(ls -A uploads)" ]; then
    tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz uploads/ 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Uploads backup completed: uploads_backup_$DATE.tar.gz${NC}"
        UPLOADS_SIZE=$(du -h $BACKUP_DIR/uploads_backup_$DATE.tar.gz | cut -f1)
        echo "  Size: $UPLOADS_SIZE"
    else
        echo -e "${YELLOW}⚠ Uploads backup skipped (directory empty or error)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Uploads directory is empty, skipping...${NC}"
fi

# Backup .env fajl (opciono, ali oprezno sa permissions)
echo -e "${YELLOW}Backing up environment file...${NC}"
if [ -f ".env" ]; then
    cp .env $BACKUP_DIR/env_backup_$DATE.env
    chmod 600 $BACKUP_DIR/env_backup_$DATE.env
    echo -e "${GREEN}✓ Environment file backed up${NC}"
fi

# Obriši stare backup-ove
echo -e "${YELLOW}Cleaning up old backups (older than $RETENTION_DAYS days)...${NC}"
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.env" -mtime +$RETENTION_DAYS -delete

# Lista backup fajlova
echo -e "${GREEN}Backup completed successfully!${NC}"
echo -e "${YELLOW}Backup files:${NC}"
ls -lh $BACKUP_DIR/*$DATE* 2>/dev/null || echo "No files found"

# Log backup
echo "$(date): Backup completed - $DATE" >> $BACKUP_DIR/logs/backup.log

