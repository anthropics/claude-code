#!/bin/bash

################################################################################
# Application Deployment Script for AI Trader's Shadow
#
# This script will:
# 1. Check prerequisites
# 2. Setup environment variables
# 3. Build and start Docker containers
# 4. Verify deployment
#
# Usage: bash deploy-app.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"

log_info "Starting deployment for AI Trader's Shadow..."
echo ""
echo "Application Directory: $APP_DIR"
echo ""

################################################################################
# 1. Prerequisites Check
################################################################################
log_info "Step 1: Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please run setup-vps.sh first."
    exit 1
fi
log_success "Docker found: $(docker --version)"

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    log_error "Docker Compose is not installed. Please run setup-vps.sh first."
    exit 1
fi
log_success "Docker Compose found: $(docker compose version)"

# Check if we're in the right directory
if [ ! -f "$APP_DIR/docker-compose.prod.yml" ]; then
    log_error "docker-compose.prod.yml not found in $APP_DIR"
    log_error "Please ensure you're running this script from the project directory"
    exit 1
fi
log_success "docker-compose.prod.yml found"
echo ""

################################################################################
# 2. Environment Setup
################################################################################
log_info "Step 2: Setting up environment variables..."

ENV_FILE="$APP_DIR/.env.prod"

if [ ! -f "$ENV_FILE" ]; then
    log_warning ".env.prod not found, creating from template..."

    if [ -f "$APP_DIR/.env.prod.example" ]; then
        cp "$APP_DIR/.env.prod.example" "$ENV_FILE"
        log_success ".env.prod created from template"
        echo ""
        log_warning "IMPORTANT: Please edit .env.prod and set production values!"
        echo ""
        echo "Required variables:"
        echo "  - DB_PASSWORD"
        echo "  - SECRET_KEY"
        echo "  - EXCHANGE_API_KEY (optional)"
        echo "  - EXCHANGE_API_SECRET (optional)"
        echo "  - TELEGRAM_BOT_TOKEN (optional)"
        echo ""
        read -p "Do you want to edit .env.prod now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ${EDITOR:-nano} "$ENV_FILE"
        else
            log_warning "Please edit .env.prod manually before running this script again"
            exit 1
        fi
    else
        log_error ".env.prod.example not found"
        exit 1
    fi
fi

# Validate critical environment variables
log_info "Validating environment variables..."

# Source the env file
set -a
source "$ENV_FILE"
set +a

# Check critical variables
MISSING_VARS=()

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "changeme_prod_password" ]; then
    MISSING_VARS+=("DB_PASSWORD")
fi

if [ -z "$SECRET_KEY" ] || [ "$SECRET_KEY" = "change-this-in-production-use-strong-secret" ]; then
    MISSING_VARS+=("SECRET_KEY")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    log_error "Missing or default values for critical variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    log_error "Please edit $ENV_FILE and set proper production values"
    exit 1
fi

log_success "Environment variables validated"
echo ""

################################################################################
# 3. Check ML Model
################################################################################
log_info "Step 3: Checking ML model..."

MODEL_FILE="$APP_DIR/backend/models/ppo_crypto_final.zip"

if [ ! -f "$MODEL_FILE" ]; then
    log_warning "ML model not found at: $MODEL_FILE"
    log_info "The backend will start but predictions will be unavailable"
    read -p "Continue without ML model? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Deployment cancelled. Please add ML model and try again."
        exit 1
    fi
else
    log_success "ML model found ($(du -h "$MODEL_FILE" | cut -f1))"
fi
echo ""

################################################################################
# 4. Stop existing containers (if any)
################################################################################
log_info "Step 4: Stopping existing containers (if any)..."

cd "$APP_DIR"

if docker compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    log_warning "Found running containers, stopping them..."
    docker compose -f docker-compose.prod.yml down
    log_success "Existing containers stopped"
else
    log_info "No running containers found"
fi
echo ""

################################################################################
# 5. Build Docker images
################################################################################
log_info "Step 5: Building Docker images..."
log_warning "This may take 5-15 minutes depending on your VPS specs..."
echo ""

docker compose -f docker-compose.prod.yml build --no-cache

log_success "Docker images built successfully"
echo ""

################################################################################
# 6. Start services
################################################################################
log_info "Step 6: Starting services..."

docker compose -f docker-compose.prod.yml up -d

log_success "Services started"
echo ""

# Wait for services to be healthy
log_info "Waiting for services to become healthy..."
sleep 10

################################################################################
# 7. Verify deployment
################################################################################
log_info "Step 7: Verifying deployment..."
echo ""

# Check service status
log_info "Service status:"
docker compose -f docker-compose.prod.yml ps
echo ""

# Check health endpoints
log_info "Checking health endpoints..."

# Check Nginx
if curl -f -s http://localhost/health > /dev/null; then
    log_success "Nginx: OK"
else
    log_error "Nginx: FAILED"
fi

# Check Backend
sleep 5  # Give backend more time to start
if curl -f -s http://localhost/api/health > /dev/null; then
    log_success "Backend API: OK"
else
    log_warning "Backend API: Not ready yet (may still be starting)"
fi

# Check Frontend
if curl -f -s http://localhost/ > /dev/null; then
    log_success "Frontend: OK"
else
    log_warning "Frontend: Not ready yet (may still be starting)"
fi

echo ""

################################################################################
# 8. Display logs (optional)
################################################################################
log_info "Recent logs from all services:"
echo ""
docker compose -f docker-compose.prod.yml logs --tail=20
echo ""

################################################################################
# Summary
################################################################################
echo "========================================================================"
log_success "Deployment Complete!"
echo "========================================================================"
echo ""
echo "Service URLs:"
echo "  Dashboard: http://localhost (or http://$(curl -s ifconfig.me))"
echo "  API Docs:  http://localhost/docs"
echo "  API:       http://localhost/api/*"
echo "  WebSocket: ws://localhost/ws/*"
echo ""
echo "Useful Commands:"
echo "  View logs (all):      docker compose -f docker-compose.prod.yml logs -f"
echo "  View logs (backend):  docker compose -f docker-compose.prod.yml logs -f backend"
echo "  Service status:       docker compose -f docker-compose.prod.yml ps"
echo "  Restart services:     docker compose -f docker-compose.prod.yml restart"
echo "  Stop services:        docker compose -f docker-compose.prod.yml down"
echo ""
echo "Next Steps:"
echo "  1. Setup domain and DNS records"
echo "  2. Configure SSL with: bash deploy/setup-ssl.sh <your-domain.com>"
echo "  3. Update CORS_ORIGINS in .env.prod with your domain"
echo "  4. Setup monitoring and backups"
echo ""
log_success "Deployment script finished!"
