#!/bin/bash

################################################################################
# Database Backup Script for AI Trader's Shadow
#
# This script will:
# 1. Create timestamped database backup
# 2. Compress the backup
# 3. Clean old backups (keep last 7 days)
# 4. Log backup status
#
# Usage: bash backup-db.sh
# Cron: 0 2 * * * /opt/ai-traders-shadow/deploy/backup-db.sh
################################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="/backup/ai-traders-shadow"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql"
RETENTION_DAYS=7

echo -e "${GREEN}AI Trader's Shadow - Database Backup${NC}"
echo "Started at: $(date)"
echo ""

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Backup database
echo "Backing up database..."
cd "$APP_DIR"

if docker compose -f docker-compose.prod.yml exec -T db pg_dump -U postgres ai_traders_shadow > "$BACKUP_FILE"; then
    echo -e "${GREEN}✓ Database backup created: $BACKUP_FILE${NC}"

    # Compress backup
    echo "Compressing backup..."
    gzip "$BACKUP_FILE"
    BACKUP_FILE="$BACKUP_FILE.gz"

    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓ Backup compressed: $BACKUP_SIZE${NC}"
else
    echo -e "${RED}✗ Backup failed!${NC}"
    exit 1
fi

# Clean old backups
echo "Cleaning old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
echo -e "${GREEN}✓ Old backups cleaned${NC}"

# Show backup summary
echo ""
echo "Backup Summary:"
echo "  File: $BACKUP_FILE"
echo "  Size: $BACKUP_SIZE"
echo "  Backups in directory: $(ls -1 $BACKUP_DIR/db_backup_*.sql.gz 2>/dev/null | wc -l)"
echo ""
echo -e "${GREEN}Backup completed successfully!${NC}"
echo "Finished at: $(date)"
