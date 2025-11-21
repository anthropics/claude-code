#!/bin/bash

################################################################################
# Modal Secrets Setup Script for AI Trader's Shadow
#
# This script helps you create Modal secrets for production deployment.
# Secrets are stored securely in Modal and injected as environment variables.
#
# Usage: bash modal_setup_secrets.sh
################################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Modal Secrets Setup - AI Trader's Shadow Backend${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if modal is installed
if ! command -v modal &> /dev/null; then
    echo -e "${RED}Error: Modal CLI is not installed${NC}"
    echo ""
    echo "Install Modal:"
    echo "  pip install modal"
    echo ""
    echo "Then authenticate:"
    echo "  modal setup"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Modal CLI found${NC}"
echo ""

# Check if authenticated
if ! modal profile list &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with Modal${NC}"
    echo ""
    echo "Run: modal setup"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Authenticated with Modal${NC}"
echo ""

# ============================================================================
# Prompt for secrets
# ============================================================================

echo -e "${YELLOW}This script will help you create Modal secrets.${NC}"
echo -e "${YELLOW}You can skip optional values by pressing Enter.${NC}"
echo ""

# Required secrets
echo -e "${BLUE}━━━ Required Secrets ━━━${NC}"
echo ""

read -p "DATABASE_URL (PostgreSQL connection string): " DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL is required${NC}"
    exit 1
fi

read -p "SECRET_KEY (Django/FastAPI secret key, 32+ chars): " SECRET_KEY
if [ -z "$SECRET_KEY" ]; then
    echo -e "${YELLOW}Generating random SECRET_KEY...${NC}"
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    echo "Generated: $SECRET_KEY"
fi

read -p "DB_PASSWORD (Database password): " DB_PASSWORD
if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Error: DB_PASSWORD is required${NC}"
    exit 1
fi

# Optional secrets
echo ""
echo -e "${BLUE}━━━ Optional Secrets (for full features) ━━━${NC}"
echo ""

read -p "EXCHANGE_API_KEY (Binance API key, optional): " EXCHANGE_API_KEY
read -p "EXCHANGE_API_SECRET (Binance API secret, optional): " EXCHANGE_API_SECRET
read -p "TELEGRAM_BOT_TOKEN (Telegram bot token, optional): " TELEGRAM_BOT_TOKEN
read -p "TELEGRAM_ADMIN_CHAT_ID (Telegram chat ID, optional): " TELEGRAM_ADMIN_CHAT_ID

# Additional configuration
echo ""
echo -e "${BLUE}━━━ Additional Configuration ━━━${NC}"
echo ""

read -p "CORS_ORIGINS (comma-separated, e.g., https://yourdomain.com): " CORS_ORIGINS_INPUT
if [ -z "$CORS_ORIGINS_INPUT" ]; then
    CORS_ORIGINS='["*"]'
else
    # Convert comma-separated to JSON array
    CORS_ORIGINS="[\"$(echo $CORS_ORIGINS_INPUT | sed 's/,/","/g')\"]"
fi

read -p "DEBUG (true/false, default: false): " DEBUG
DEBUG=${DEBUG:-false}

# ============================================================================
# Create secrets in Modal
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Creating secrets in Modal...${NC}"
echo ""

# Build the modal secret create command
CMD="modal secret create ai-traders-shadow-secrets"

# Add required secrets
CMD="$CMD DATABASE_URL=\"$DATABASE_URL\""
CMD="$CMD SECRET_KEY=\"$SECRET_KEY\""
CMD="$CMD DB_PASSWORD=\"$DB_PASSWORD\""

# Add optional secrets (only if provided)
[ -n "$EXCHANGE_API_KEY" ] && CMD="$CMD EXCHANGE_API_KEY=\"$EXCHANGE_API_KEY\""
[ -n "$EXCHANGE_API_SECRET" ] && CMD="$CMD EXCHANGE_API_SECRET=\"$EXCHANGE_API_SECRET\""
[ -n "$TELEGRAM_BOT_TOKEN" ] && CMD="$CMD TELEGRAM_BOT_TOKEN=\"$TELEGRAM_BOT_TOKEN\""
[ -n "$TELEGRAM_ADMIN_CHAT_ID" ] && CMD="$CMD TELEGRAM_ADMIN_CHAT_ID=\"$TELEGRAM_ADMIN_CHAT_ID\""

# Add configuration
CMD="$CMD CORS_ORIGINS='$CORS_ORIGINS'"
CMD="$CMD DEBUG=\"$DEBUG\""

# Add other default configuration
CMD="$CMD API_HOST=\"0.0.0.0\""
CMD="$CMD API_PORT=\"8000\""
CMD="$CMD MODEL_PATH=\"/app/models\""
CMD="$CMD EXCHANGE_NAME=\"binance\""
CMD="$CMD EXCHANGE_TESTNET=\"true\""
CMD="$CMD MAX_SPREAD_BPS=\"50.0\""
CMD="$CMD MIN_LIQUIDITY_USD=\"10000.0\""
CMD="$CMD MAX_TRADES_PER_HOUR=\"5\""
CMD="$CMD MIN_ORDER_SIZE_USD=\"10.0\""
CMD="$CMD MOOD_LOOKBACK_TRADES=\"10\""
CMD="$CMD MOOD_UPDATE_INTERVAL_SECONDS=\"60\""
CMD="$CMD PAPER_TRADING_INITIAL_BALANCE=\"100.0\""

# Execute the command
echo -e "${YELLOW}Executing:${NC}"
echo "$CMD" | sed 's/SECRET_KEY="[^"]*"/SECRET_KEY="***"/g' | sed 's/DB_PASSWORD="[^"]*"/DB_PASSWORD="***"/g' | sed 's/DATABASE_URL="[^"]*"/DATABASE_URL="***"/g'
echo ""

eval $CMD

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✓ Secrets created successfully!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Secret name: ai-traders-shadow-secrets"
    echo ""
    echo "Next steps:"
    echo "  1. Test locally:    modal run backend.app.modal_app"
    echo "  2. Deploy:          modal deploy backend.app.modal_app"
    echo "  3. View secrets:    modal secret list"
    echo "  4. View logs:       modal app logs ai-traders-shadow-backend"
    echo ""
else
    echo ""
    echo -e "${RED}Error creating secrets!${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  - Check if secret already exists: modal secret list"
    echo "  - Delete existing: modal secret delete ai-traders-shadow-secrets"
    echo "  - Try again: bash modal_setup_secrets.sh"
    echo ""
    exit 1
fi

# ============================================================================
# Save configuration reference (for documentation)
# ============================================================================

echo "Saving configuration reference to modal_secrets_reference.txt..."

cat > modal_secrets_reference.txt <<EOF
# Modal Secrets Reference - AI Trader's Shadow Backend
# Created: $(date)

Secret Name: ai-traders-shadow-secrets

Environment Variables:
- DATABASE_URL: *** (PostgreSQL connection string)
- SECRET_KEY: *** (32+ character secret key)
- DB_PASSWORD: *** (Database password)
- EXCHANGE_API_KEY: ${EXCHANGE_API_KEY:-<not set>}
- EXCHANGE_API_SECRET: *** (if set)
- TELEGRAM_BOT_TOKEN: *** (if set)
- TELEGRAM_ADMIN_CHAT_ID: ${TELEGRAM_ADMIN_CHAT_ID:-<not set>}
- CORS_ORIGINS: $CORS_ORIGINS
- DEBUG: $DEBUG

Other Configuration:
- API_HOST: 0.0.0.0
- API_PORT: 8000
- MODEL_PATH: /app/models
- EXCHANGE_NAME: binance
- EXCHANGE_TESTNET: true

Commands:
- Update secrets: modal secret create ai-traders-shadow-secrets KEY=value (--force to overwrite)
- View secrets: modal secret list
- Delete secrets: modal secret delete ai-traders-shadow-secrets

Deployment:
- Test locally: modal run backend.app.modal_app
- Deploy: modal deploy backend.app.modal_app
- Logs: modal app logs ai-traders-shadow-backend --follow
EOF

echo -e "${GREEN}✓ Configuration reference saved to modal_secrets_reference.txt${NC}"
echo ""
echo -e "${YELLOW}⚠️  Keep modal_secrets_reference.txt secure (it's in .gitignore)${NC}"
echo ""
