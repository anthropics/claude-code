#!/bin/bash

################################################################################
# Modal Deployment Script for AI Trader's Shadow Backend
#
# This script deploys the FastAPI backend to Modal.com
#
# Usage: bash modal_deploy.sh [test|deploy]
################################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Default mode
MODE=${1:-deploy}

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Modal Deployment - AI Trader's Shadow Backend${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================================
# Prerequisites Check
# ============================================================================

echo -e "${YELLOW}Checking prerequisites...${NC}"
echo ""

# Check if modal is installed
if ! command -v modal &> /dev/null; then
    echo -e "${RED}✗ Modal CLI is not installed${NC}"
    echo ""
    echo "Install Modal:"
    echo "  pip install modal"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓ Modal CLI installed${NC}"

# Check if authenticated
if ! modal profile list &> /dev/null; then
    echo -e "${RED}✗ Not authenticated with Modal${NC}"
    echo ""
    echo "Authenticate:"
    echo "  modal setup"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓ Authenticated with Modal${NC}"

# Check if secrets exist
if ! modal secret list | grep -q "ai-traders-shadow-secrets"; then
    echo -e "${RED}✗ Secrets not found${NC}"
    echo ""
    echo "Create secrets first:"
    echo "  bash modal_setup_secrets.sh"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓ Secrets configured${NC}"

# Check if ML model exists
if [ ! -f "models/ppo_crypto_final.zip" ]; then
    echo -e "${YELLOW}⚠ ML model not found at models/ppo_crypto_final.zip${NC}"
    echo ""
    read -p "Continue without ML model? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ ML model found ($(du -h models/ppo_crypto_final.zip | cut -f1))${NC}"
fi

echo ""

# ============================================================================
# Deployment
# ============================================================================

if [ "$MODE" = "test" ]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Testing locally with Modal...${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "This will:"
    echo "  1. Build Docker image locally"
    echo "  2. Start Modal container"
    echo "  3. Run FastAPI app"
    echo "  4. Provide local URL for testing"
    echo ""
    read -p "Press Enter to continue..."
    echo ""

    # Run locally
    modal run app.modal_app

elif [ "$MODE" = "deploy" ]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Deploying to Modal.com production...${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "This will:"
    echo "  1. Build Docker image"
    echo "  2. Push to Modal registry"
    echo "  3. Deploy FastAPI app"
    echo "  4. Provide production URL"
    echo ""
    read -p "Deploy to production? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 0
    fi
    echo ""

    # Deploy to production
    modal deploy app.modal_app

    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✓ Deployment successful!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Your API is now live!"
    echo ""
    echo "Next steps:"
    echo "  1. Get your production URL from Modal output above"
    echo "  2. Test the API:"
    echo "     curl https://your-org--ai-traders-shadow-backend-web.modal.run/health"
    echo "  3. Update frontend environment variables:"
    echo "     NEXT_PUBLIC_API_URL=https://your-org--ai-traders-shadow-backend-web.modal.run/api/v1"
    echo "     NEXT_PUBLIC_WS_URL=wss://your-org--ai-traders-shadow-backend-web.modal.run/ws"
    echo "  4. View logs:"
    echo "     modal app logs ai-traders-shadow-backend --follow"
    echo ""

else
    echo -e "${RED}Invalid mode: $MODE${NC}"
    echo ""
    echo "Usage: bash modal_deploy.sh [test|deploy]"
    echo "  test   - Run locally for testing"
    echo "  deploy - Deploy to production"
    exit 1
fi

# ============================================================================
# Post-deployment Info
# ============================================================================

echo ""
echo "Useful commands:"
echo "  View logs:     modal app logs ai-traders-shadow-backend --follow"
echo "  Check status:  modal app list"
echo "  Stop app:      modal app stop ai-traders-shadow-backend"
echo "  Update app:    modal deploy app.modal_app"
echo ""
