#!/bin/bash

# Quick Start Script for AI Trader's Shadow Production Deployment
# This script helps you quickly deploy the application

set -e

echo "=================================================="
echo "  AI Trader's Shadow - Production Deployment"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_success "Docker is installed"

# Check if Docker Compose is installed
if ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
print_success "Docker Compose is installed"

# Check if ML model exists
if [ ! -f "backend/models/ppo_crypto_final.zip" ]; then
    print_warning "ML model not found at backend/models/ppo_crypto_final.zip"
    print_info "You may need to train the model first or copy it to this location"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_success "ML model found"
fi

# Check if .env.prod exists
if [ ! -f ".env.prod" ]; then
    print_warning ".env.prod not found"
    print_info "Creating .env.prod from .env.prod.example..."

    if [ -f ".env.prod.example" ]; then
        cp .env.prod.example .env.prod
        print_success ".env.prod created"
        print_warning "Please edit .env.prod and add your production credentials:"
        print_info "  - DB_PASSWORD"
        print_info "  - SECRET_KEY"
        print_info "  - EXCHANGE_API_KEY (optional)"
        print_info "  - EXCHANGE_API_SECRET (optional)"
        print_info "  - TELEGRAM_BOT_TOKEN (optional)"
        echo ""
        read -p "Press Enter after editing .env.prod to continue..."
    else
        print_error ".env.prod.example not found"
        exit 1
    fi
else
    print_success ".env.prod exists"
fi

# Export environment variables
export $(cat .env.prod | grep -v '^#' | xargs)

# Menu
echo ""
echo "What would you like to do?"
echo "1) Build and start all services"
echo "2) Start services (without rebuild)"
echo "3) Stop all services"
echo "4) View logs"
echo "5) Check service status"
echo "6) Backup database"
echo "7) Clean up (remove all containers and volumes)"
echo "8) Exit"
echo ""
read -p "Enter your choice [1-8]: " choice

case $choice in
    1)
        print_info "Building and starting all services..."
        docker compose -f docker-compose.prod.yml up -d --build
        print_success "All services started!"
        echo ""
        print_info "Access the application at: http://localhost"
        print_info "API docs at: http://localhost/docs"
        print_info "View logs: docker compose -f docker-compose.prod.yml logs -f"
        ;;
    2)
        print_info "Starting all services..."
        docker compose -f docker-compose.prod.yml up -d
        print_success "All services started!"
        ;;
    3)
        print_info "Stopping all services..."
        docker compose -f docker-compose.prod.yml down
        print_success "All services stopped!"
        ;;
    4)
        print_info "Showing logs (Ctrl+C to exit)..."
        docker compose -f docker-compose.prod.yml logs -f
        ;;
    5)
        print_info "Service status:"
        docker compose -f docker-compose.prod.yml ps
        ;;
    6)
        backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
        print_info "Creating database backup: $backup_file"
        docker compose -f docker-compose.prod.yml exec -T db pg_dump -U postgres ai_traders_shadow > "$backup_file"
        print_success "Backup created: $backup_file"
        ;;
    7)
        print_warning "This will remove ALL containers and volumes (including database data)!"
        read -p "Are you sure? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            docker compose -f docker-compose.prod.yml down -v
            print_success "Cleanup complete!"
        else
            print_info "Cancelled"
        fi
        ;;
    8)
        print_info "Goodbye!"
        exit 0
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
print_success "Done!"
