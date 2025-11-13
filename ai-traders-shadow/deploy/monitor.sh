#!/bin/bash

################################################################################
# Real-time Monitoring Script for AI Trader's Shadow
#
# This script provides a TUI (Text User Interface) for monitoring:
# 1. Container status and stats
# 2. Live logs
# 3. Resource usage
# 4. Recent errors
#
# Usage: bash monitor.sh
################################################################################

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

clear

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         AI Trader's Shadow - System Monitor                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

show_menu() {
    echo -e "${CYAN}Select monitoring option:${NC}"
    echo ""
    echo "  1) Service Status"
    echo "  2) Live Logs (All Services)"
    echo "  3) Live Logs (Backend Only)"
    echo "  4) Live Logs (Frontend Only)"
    echo "  5) Container Resource Stats"
    echo "  6) Health Check"
    echo "  7) Recent Errors"
    echo "  8) Database Status"
    echo "  9) System Resources"
    echo "  0) Exit"
    echo ""
    read -p "Enter choice [0-9]: " choice
}

service_status() {
    clear
    echo -e "${BLUE}=== Service Status ===${NC}"
    echo ""
    cd "$APP_DIR"
    docker compose -f docker-compose.prod.yml ps
    echo ""
    read -p "Press Enter to continue..."
}

live_logs_all() {
    clear
    echo -e "${BLUE}=== Live Logs (All Services) ===${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
    echo ""
    cd "$APP_DIR"
    docker compose -f docker-compose.prod.yml logs -f
}

live_logs_backend() {
    clear
    echo -e "${BLUE}=== Live Logs (Backend) ===${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
    echo ""
    cd "$APP_DIR"
    docker compose -f docker-compose.prod.yml logs -f backend
}

live_logs_frontend() {
    clear
    echo -e "${BLUE}=== Live Logs (Frontend) ===${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
    echo ""
    cd "$APP_DIR"
    docker compose -f docker-compose.prod.yml logs -f frontend
}

container_stats() {
    clear
    echo -e "${BLUE}=== Container Resource Stats ===${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
    echo ""
    docker stats $(docker ps --filter "name=ai_traders" --format "{{.Names}}")
}

health_check() {
    clear
    echo -e "${BLUE}=== Health Check ===${NC}"
    echo ""
    bash "$SCRIPT_DIR/health-check.sh"
    echo ""
    read -p "Press Enter to continue..."
}

recent_errors() {
    clear
    echo -e "${BLUE}=== Recent Errors ===${NC}"
    echo ""
    cd "$APP_DIR"

    echo -e "${YELLOW}Backend Errors:${NC}"
    docker compose -f docker-compose.prod.yml logs backend | grep -i "error\|exception\|failed" | tail -20

    echo ""
    echo -e "${YELLOW}Frontend Errors:${NC}"
    docker compose -f docker-compose.prod.yml logs frontend | grep -i "error\|exception\|failed" | tail -20

    echo ""
    read -p "Press Enter to continue..."
}

database_status() {
    clear
    echo -e "${BLUE}=== Database Status ===${NC}"
    echo ""
    cd "$APP_DIR"

    echo "Connection Status:"
    docker compose -f docker-compose.prod.yml exec db pg_isready -U postgres

    echo ""
    echo "Database Size:"
    docker compose -f docker-compose.prod.yml exec -T db psql -U postgres -d ai_traders_shadow -c "SELECT pg_size_pretty(pg_database_size('ai_traders_shadow'));"

    echo ""
    echo "Active Connections:"
    docker compose -f docker-compose.prod.yml exec -T db psql -U postgres -d ai_traders_shadow -c "SELECT count(*) FROM pg_stat_activity WHERE datname='ai_traders_shadow';"

    echo ""
    echo "Recent Trades (last 10):"
    docker compose -f docker-compose.prod.yml exec -T db psql -U postgres -d ai_traders_shadow -c "SELECT id, user_id, symbol, side, quantity, price, created_at FROM trades_paper ORDER BY created_at DESC LIMIT 10;"

    echo ""
    read -p "Press Enter to continue..."
}

system_resources() {
    clear
    echo -e "${BLUE}=== System Resources ===${NC}"
    echo ""

    echo -e "${CYAN}CPU & Load:${NC}"
    uptime
    echo ""

    echo -e "${CYAN}Memory Usage:${NC}"
    free -h
    echo ""

    echo -e "${CYAN}Disk Usage:${NC}"
    df -h /
    echo ""

    echo -e "${CYAN}Docker Disk Usage:${NC}"
    docker system df
    echo ""

    echo -e "${CYAN}Network Connections:${NC}"
    ss -tunap | grep -E "docker|:80|:443|:8000|:3000" | head -20
    echo ""

    read -p "Press Enter to continue..."
}

# Main loop
while true; do
    clear
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║         AI Trader's Shadow - System Monitor                   ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    show_menu

    case $choice in
        1) service_status ;;
        2) live_logs_all ;;
        3) live_logs_backend ;;
        4) live_logs_frontend ;;
        5) container_stats ;;
        6) health_check ;;
        7) recent_errors ;;
        8) database_status ;;
        9) system_resources ;;
        0)
            echo ""
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            sleep 1
            ;;
    esac
done
