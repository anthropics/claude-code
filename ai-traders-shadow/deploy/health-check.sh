#!/bin/bash

################################################################################
# Health Check Script for AI Trader's Shadow
#
# This script checks:
# 1. Service status (Docker containers)
# 2. Health endpoints (HTTP)
# 3. Database connectivity
# 4. Disk space
# 5. Memory usage
#
# Usage: bash health-check.sh
# Cron: */5 * * * * /opt/ai-traders-shadow/deploy/health-check.sh
################################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/ai-traders-shadow/health-check.log"
ALERT_EMAIL=""  # Set email for alerts (optional)

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check and alert
check_and_alert() {
    local check_name=$1
    local status=$2
    local message=$3

    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✓${NC} $check_name: OK"
        log "OK - $check_name"
    else
        echo -e "${RED}✗${NC} $check_name: FAILED - $message"
        log "FAILED - $check_name: $message"

        # Send alert if email configured
        if [ -n "$ALERT_EMAIL" ]; then
            echo "Alert: $check_name failed - $message" | mail -s "AI Trader's Shadow Alert" "$ALERT_EMAIL"
        fi
    fi
}

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}AI Trader's Shadow - Health Check${NC}"
echo -e "${BLUE}======================================${NC}"
echo "Time: $(date)"
echo ""

################################################################################
# 1. Docker Service Status
################################################################################
echo -e "${BLUE}[1] Checking Docker Services...${NC}"

cd "$APP_DIR"

# Check if docker-compose file exists
if [ ! -f "docker-compose.prod.yml" ]; then
    check_and_alert "Docker Compose File" "FAILED" "docker-compose.prod.yml not found"
    exit 1
fi

# Check each service
SERVICES=("db" "backend" "frontend" "nginx")
ALL_SERVICES_OK=true

for service in "${SERVICES[@]}"; do
    if docker compose -f docker-compose.prod.yml ps "$service" | grep -q "Up"; then
        check_and_alert "Service: $service" "OK" ""
    else
        check_and_alert "Service: $service" "FAILED" "Container not running"
        ALL_SERVICES_OK=false
    fi
done

echo ""

################################################################################
# 2. Health Endpoints
################################################################################
echo -e "${BLUE}[2] Checking Health Endpoints...${NC}"

# Nginx health
if curl -f -s http://localhost/health > /dev/null 2>&1; then
    check_and_alert "Nginx Health" "OK" ""
else
    check_and_alert "Nginx Health" "FAILED" "Endpoint not responding"
fi

# Backend API health
if curl -f -s http://localhost/api/health > /dev/null 2>&1; then
    check_and_alert "Backend API Health" "OK" ""
else
    check_and_alert "Backend API Health" "FAILED" "Endpoint not responding"
fi

# Frontend
if curl -f -s http://localhost/ > /dev/null 2>&1; then
    check_and_alert "Frontend" "OK" ""
else
    check_and_alert "Frontend" "FAILED" "Not responding"
fi

echo ""

################################################################################
# 3. Database Connectivity
################################################################################
echo -e "${BLUE}[3] Checking Database...${NC}"

if docker compose -f docker-compose.prod.yml exec -T db pg_isready -U postgres > /dev/null 2>&1; then
    check_and_alert "Database Connection" "OK" ""
else
    check_and_alert "Database Connection" "FAILED" "Cannot connect to database"
fi

echo ""

################################################################################
# 4. System Resources
################################################################################
echo -e "${BLUE}[4] Checking System Resources...${NC}"

# Disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    check_and_alert "Disk Space" "OK" "Usage: ${DISK_USAGE}%"
elif [ "$DISK_USAGE" -lt 90 ]; then
    check_and_alert "Disk Space" "WARNING" "Usage: ${DISK_USAGE}% (Warning threshold)"
else
    check_and_alert "Disk Space" "FAILED" "Usage: ${DISK_USAGE}% (Critical!)"
fi

# Memory usage
MEM_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100.0}')
if [ "$MEM_USAGE" -lt 80 ]; then
    check_and_alert "Memory Usage" "OK" "Usage: ${MEM_USAGE}%"
elif [ "$MEM_USAGE" -lt 90 ]; then
    check_and_alert "Memory Usage" "WARNING" "Usage: ${MEM_USAGE}% (Warning threshold)"
else
    check_and_alert "Memory Usage" "FAILED" "Usage: ${MEM_USAGE}% (Critical!)"
fi

# CPU load
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
CPU_COUNT=$(nproc)
LOAD_PER_CPU=$(echo "$LOAD_AVG / $CPU_COUNT" | bc -l)
LOAD_PERCENT=$(echo "$LOAD_PER_CPU * 100" | bc -l | cut -d'.' -f1)

if [ "$LOAD_PERCENT" -lt 80 ]; then
    check_and_alert "CPU Load" "OK" "Load: $LOAD_AVG (${LOAD_PERCENT}% per CPU)"
elif [ "$LOAD_PERCENT" -lt 100 ]; then
    check_and_alert "CPU Load" "WARNING" "Load: $LOAD_AVG (${LOAD_PERCENT}% per CPU)"
else
    check_and_alert "CPU Load" "FAILED" "Load: $LOAD_AVG (${LOAD_PERCENT}% per CPU - Overloaded!)"
fi

echo ""

################################################################################
# 5. Docker Container Stats
################################################################################
echo -e "${BLUE}[5] Docker Container Stats...${NC}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep ai_traders
echo ""

################################################################################
# Summary
################################################################################
echo -e "${BLUE}======================================${NC}"
if [ "$ALL_SERVICES_OK" = true ]; then
    echo -e "${GREEN}Status: All systems operational ✓${NC}"
else
    echo -e "${RED}Status: Some services have issues ✗${NC}"
fi
echo -e "${BLUE}======================================${NC}"
echo ""

# Log summary
if [ "$ALL_SERVICES_OK" = true ]; then
    log "Health check completed: All systems OK"
else
    log "Health check completed: Issues detected"
fi
