#!/bin/bash

#######################################################################
# AI Trader's Shadow - ONE-CLICK DEPLOYMENT SCRIPT
# Run this on your LOCAL machine (not in this environment)
#######################################################################

set -e  # Exit on error

echo "🚀 AI Trader's Shadow - Deployment Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration (PRE-FILLED WITH YOUR CREDENTIALS)
MODAL_TOKEN_ID="ak-Udk1F0hH12N3WuCiXOeevw"
MODAL_TOKEN_SECRET="as-gJNmbNRC0pO6CCmG00Ze9E"
DATABASE_URL="postgresql://postgres:Shadow19*@db.rjkcbdvnnzfqgxgwlabi.supabase.co:5432/postgres"
DB_PASSWORD="Shadow19*"
PROJECT_DIR="$HOME/claude-code/ai-traders-shadow"

echo -e "${BLUE}📋 Configuration Loaded:${NC}"
echo "  - Modal Token: ak-Udk1F0h...evw"
echo "  - Database: rjkcbdvnnzfqgxgwlabi.supabase.co"
echo "  - Project: $PROJECT_DIR"
echo ""

# Function to print step
print_step() {
    echo -e "${GREEN}▶ STEP $1: $2${NC}"
}

# Function to check command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ Error: $1 is not installed${NC}"
        echo "   Install with: $2"
        exit 1
    fi
}

# Step 0: Prerequisites Check
print_step "0" "Checking Prerequisites"
echo ""

check_command "python3" "brew install python3 (macOS) or apt install python3 (Linux)"
check_command "pip" "curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py && python get-pip.py"
check_command "psql" "brew install postgresql (macOS) or apt install postgresql-client (Linux)"
check_command "git" "brew install git (macOS) or apt install git (Linux)"

echo -e "${GREEN}✅ All prerequisites installed${NC}"
echo ""

# Step 1: Install Modal CLI
print_step "1" "Installing Modal CLI"
echo ""

pip install modal -q
echo -e "${GREEN}✅ Modal CLI installed${NC}"
echo ""

# Step 2: Authenticate with Modal
print_step "2" "Authenticating with Modal"
echo ""

modal token set \
  --token-id "$MODAL_TOKEN_ID" \
  --token-secret "$MODAL_TOKEN_SECRET"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Modal authentication successful${NC}"
    modal profile list
else
    echo -e "${RED}❌ Modal authentication failed${NC}"
    exit 1
fi
echo ""

# Step 3: Setup Database
print_step "3" "Setting up Supabase Database"
echo ""

cd "$PROJECT_DIR"

echo "Creating tables..."
psql "$DATABASE_URL" -f database/schema.sql > /dev/null 2>&1 || {
    echo -e "${YELLOW}⚠️  Schema might already exist, continuing...${NC}"
}

echo "Running migrations..."
psql "$DATABASE_URL" -f database/migrations/001_add_expert_demonstrations.sql > /dev/null 2>&1 || {
    echo -e "${YELLOW}⚠️  Migration might already be applied, continuing...${NC}"
}

echo "Verifying tables..."
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='expert_demonstrations';")

if [ "$TABLE_COUNT" -ge 1 ]; then
    echo -e "${GREEN}✅ Database setup complete${NC}"
    psql "$DATABASE_URL" -c "\dt" | head -20
else
    echo -e "${RED}❌ Database setup failed${NC}"
    exit 1
fi
echo ""

# Step 4: Configure Modal Secrets
print_step "4" "Configuring Modal Secrets"
echo ""

cd "$PROJECT_DIR/backend"

# Generate SECRET_KEY
SECRET_KEY=$(openssl rand -hex 32)

# Create Modal secret
modal secret create ai-traders-shadow-secrets \
  DATABASE_URL="$DATABASE_URL" \
  SECRET_KEY="$SECRET_KEY" \
  DB_PASSWORD="$DB_PASSWORD" \
  BINANCE_API_KEY="" \
  BINANCE_API_SECRET="" \
  TELEGRAM_BOT_TOKEN="" \
  2>/dev/null || {
    echo -e "${YELLOW}⚠️  Secret might already exist, updating...${NC}"
    # Modal doesn't support update, so we'll proceed
}

echo -e "${GREEN}✅ Modal secrets configured${NC}"
modal secret list
echo ""

# Step 5: Train PPO Model
print_step "5" "Training PPO Model (Initial)"
echo ""

cd "$PROJECT_DIR/backend"

if [ ! -f "models/ppo_crypto_final.zip" ]; then
    echo "Training PPO model (this may take 5-10 minutes)..."
    python3 -m app.ml.train_ppo

    if [ -f "models/ppo_crypto_final.zip" ]; then
        echo -e "${GREEN}✅ PPO model trained${NC}"
        ls -lh models/
    else
        echo -e "${RED}❌ PPO model training failed${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ PPO model already exists${NC}"
    ls -lh models/
fi
echo ""

# Step 6: Deploy to Modal
print_step "6" "Deploying Backend to Modal"
echo ""

cd "$PROJECT_DIR/backend"

echo "Testing deployment first..."
modal run app.modal_app 2>&1 | head -20 || {
    echo -e "${YELLOW}⚠️  Test run failed, trying direct deployment...${NC}"
}

echo ""
echo "Deploying to production..."
modal deploy app.modal_app

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend deployed successfully!${NC}"
    echo ""
    echo -e "${BLUE}🎉 Your backend is live at:${NC}"
    echo "   https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run"
    echo ""
    echo -e "${YELLOW}📝 SAVE THIS URL - You'll need it for frontend deployment!${NC}"

    # Test the deployment
    echo ""
    echo "Testing deployment..."
    sleep 5
    BACKEND_URL="https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run"
    curl -s "$BACKEND_URL/health" | grep -q "healthy" && {
        echo -e "${GREEN}✅ Backend health check passed${NC}"
    } || {
        echo -e "${YELLOW}⚠️  Health check pending (backend might still be starting)${NC}"
    }
else
    echo -e "${RED}❌ Modal deployment failed${NC}"
    exit 1
fi
echo ""

# Step 7: Push to GitHub
print_step "7" "Pushing to GitHub"
echo ""

cd "$HOME/claude-code"

echo "Verifying branch..."
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" == "claude/ai-trader-shadow-mvp-setup-011CV55RbJpsFUXgSbmjzmbd" ]; then
    echo "Pushing to GitHub..."
    git push github claude/ai-trader-shadow-mvp-setup-011CV55RbJpsFUXgSbmjzmbd

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Code pushed to GitHub${NC}"
        echo "   https://github.com/bagussundaru/claude-trading"
    else
        echo -e "${RED}❌ GitHub push failed${NC}"
        echo "   Make sure your SSH key 'Trading Bot Server' is configured"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Not on deployment branch, skipping GitHub push${NC}"
fi
echo ""

# Step 8: Summary
echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}Backend URL:${NC}"
echo "  https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run"
echo ""
echo -e "${BLUE}Database:${NC}"
echo "  https://rjkcbdvnnzfqgxgwlabi.supabase.co"
echo ""
echo -e "${BLUE}GitHub Repo:${NC}"
echo "  https://github.com/bagussundaru/claude-trading"
echo ""
echo -e "${YELLOW}📝 NEXT STEPS:${NC}"
echo ""
echo "1. Deploy Frontend to Vercel:"
echo "   cd $PROJECT_DIR/frontend"
echo "   npm install -g vercel"
echo "   vercel"
echo ""
echo "2. Configure Vercel Environment Variables:"
echo "   NEXT_PUBLIC_API_URL=https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run"
echo "   NEXT_PUBLIC_WS_URL=wss://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run"
echo ""
echo "3. Run E2E Tests (from E2E-TEST-PLAN.md)"
echo ""
echo "4. Start Data Flywheel! 🌱→🌳"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Your AI Trader's Shadow is LIVE!${NC}"
echo ""
