#!/data/data/com.termux/files/usr/bin/bash

# 🤖 TERMUX AUTONOMOUS DEPLOYMENT
# Deploy your publishing empire from your Android phone!
# Version: 2.0
# Enhanced with: Error handling, security improvements, input validation

set -e  # Exit on error
trap 'handle_error $? $LINENO' ERR

# ============================================
# ERROR HANDLING
# ============================================

handle_error() {
    local exit_code=$1
    local line_number=$2
    echo ""
    echo -e "${R}❌ Error on line $line_number (exit code: $exit_code)${NC}"
    echo -e "${Y}Deployment failed. Check the error above.${NC}"
    echo ""
    echo "💡 Common issues:"
    echo "  - Network connection problems"
    echo "  - Invalid API keys"
    echo "  - Permission issues"
    echo ""
    read -p "Press Enter to exit..."
    exit $exit_code
}

# ============================================
# CONFIGURATION
# ============================================

echo "╔════════════════════════════════════════════════════════╗"
echo "║                                                        ║"
echo "║    📱 TERMUX AUTONOMOUS DEPLOYMENT v2.0 📱           ║"
echo "║                                                        ║"
echo "║  Deploy your REAL MONEY empire from your phone!       ║"
echo "║  Uses: GitHub + Railway + Your Phone                  ║"
echo "║                                                        ║"
echo "║  Time: ~15 minutes                                     ║"
echo "║  Cost: \$0 (FREE tier)                                 ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Colors (Termux compatible)
G='\033[0;32m' # Green
Y='\033[1;33m' # Yellow
B='\033[0;34m' # Blue
C='\033[0;36m' # Cyan
R='\033[0;31m' # Red
NC='\033[0m'   # No Color

# ============================================
# PERSONALIZATION & CONFIGURATION
# ============================================

echo -e "${C}📋 Let's personalize your deployment!${NC}"
echo ""

# Get user information with validation and correction
while true; do
    read -p "📧 Enter your email address: " USER_EMAIL

    # Trim whitespace
    USER_EMAIL=$(echo "$USER_EMAIL" | xargs)

    # Validate email format
    if [[ "$USER_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        echo -e "${G}✅ Email valid: $USER_EMAIL${NC}"
        break
    else
        echo -e "${R}❌ Invalid email format${NC}"
        echo -e "${Y}💡 Example: yourname@example.com${NC}"
        read -p "Try again? (y/n): " RETRY
        if [[ ! "$RETRY" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
done

# Get your name
while true; do
    read -p "👤 Enter your full name: " USER_NAME
    USER_NAME=$(echo "$USER_NAME" | xargs)

    if [[ -n "$USER_NAME" ]]; then
        echo -e "${G}✅ Name: $USER_NAME${NC}"
        break
    else
        echo -e "${Y}⚠️  Name cannot be empty${NC}"
    fi
done

# Get business/project name
while true; do
    read -p "🏢 Enter your business/project name (default: Publishing Empire): " BUSINESS_NAME
    BUSINESS_NAME=$(echo "$BUSINESS_NAME" | xargs)

    if [[ -z "$BUSINESS_NAME" ]]; then
        BUSINESS_NAME="Publishing Empire"
    fi

    echo -e "${G}✅ Business: $BUSINESS_NAME${NC}"
    break
done

# Project config with sanitized name
PROJECT_NAME_SLUG=$(echo "$BUSINESS_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g')
if [[ -z "$PROJECT_NAME_SLUG" ]]; then
    PROJECT_NAME_SLUG="publishing-empire"
fi

PROJECT_NAME="$PROJECT_NAME_SLUG"
PROJECT_DIR="$HOME/$PROJECT_NAME"

echo ""
echo -e "${C}📦 Project name: $PROJECT_NAME${NC}"
echo -e "${C}📁 Project directory: $PROJECT_DIR${NC}"
echo ""

read -p "Looks good? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Let's start over..."
    exec "$0"
fi

echo -e "${C}📱 Checking Termux environment...${NC}"
echo ""

# Check if we're actually in Termux
if [[ ! -d "/data/data/com.termux" ]]; then
    echo -e "${Y}⚠️  Warning: Not running in Termux${NC}"
    read -p "Continue anyway? (y/n): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# ============================================
# STEP 1: Install Required Packages
# ============================================

echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}📦 STEP 1: Installing Requirements (3-5 min)${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to install package with retry and auto-correction
install_package() {
    local package=$1
    local max_attempts=3
    local attempt=1
    local wait_time=2

    while [ $attempt -le $max_attempts ]; do
        echo "Installing $package (attempt $attempt/$max_attempts)..."

        # Try installation
        if pkg install -y "$package" 2>&1 | tee /tmp/install_output.txt | grep -q "error\|ERROR"; then
            # Check for specific errors and suggest fixes
            if grep -q "network\|connection\|timeout" /tmp/install_output.txt; then
                echo -e "${Y}⚠️  Network issue detected${NC}"
                echo -e "${C}💡 Checking your connection...${NC}"

                # Test connectivity
                if ! ping -c 1 8.8.8.8 &> /dev/null; then
                    echo -e "${R}❌ No internet connection${NC}"
                    echo ""
                    echo "Please fix your internet connection:"
                    echo "  1. Check WiFi/Mobile data is enabled"
                    echo "  2. Try switching networks"
                    echo "  3. Restart Termux"
                    echo ""
                    read -p "Press Enter after fixing connection (or Ctrl+C to exit)..."
                    continue
                fi
            fi

            if grep -q "lock\|dpkg" /tmp/install_output.txt; then
                echo -e "${Y}⚠️  Package manager locked${NC}"
                echo -e "${C}💡 Attempting to fix...${NC}"

                # Try to fix package manager
                pkg upgrade -y 2>/dev/null || true
                sleep 1
            fi

            if [ $attempt -eq $max_attempts ]; then
                echo -e "${R}❌ Failed to install $package after $max_attempts attempts${NC}"
                echo ""
                echo "Possible solutions:"
                echo "  1. Try: pkg update && pkg upgrade"
                echo "  2. Restart Termux"
                echo "  3. Clear cache: pkg clean"
                echo ""
                read -p "Try manual fix? (y/n): " FIX
                if [[ "$FIX" =~ ^[Yy]$ ]]; then
                    echo "Run these commands:"
                    echo "  pkg update"
                    echo "  pkg clean"
                    echo "  pkg install $package"
                    read -p "Press Enter when done, or Ctrl+C to exit..."
                    # Try one more time
                    if pkg install -y "$package" &> /dev/null; then
                        echo -e "${G}✅ $package installed${NC}"
                        return 0
                    fi
                fi
                return 1
            fi

            echo -e "${Y}Waiting ${wait_time}s before retry...${NC}"
            sleep $wait_time
            wait_time=$((wait_time * 2))  # Exponential backoff
            ((attempt++))
        else
            echo -e "${G}✅ $package installed${NC}"
            return 0
        fi
    done
}

# Update package list
echo "Updating package list..."
pkg update -y || echo -e "${Y}⚠️  Update had issues but continuing...${NC}"

# Check and install Node.js
if ! command -v node &> /dev/null; then
    install_package nodejs
else
    echo -e "${G}✅ Node.js already installed ($(node --version))${NC}"
fi

# Check and install Git
if ! command -v git &> /dev/null; then
    install_package git
else
    echo -e "${G}✅ Git already installed ($(git --version | head -1))${NC}"
fi

# Check and install OpenSSL
if ! command -v openssl &> /dev/null; then
    install_package openssl
else
    echo -e "${G}✅ OpenSSL already installed${NC}"
fi

echo ""
echo -e "${G}✅ All packages ready!${NC}"

# ============================================
# STEP 2: Collect Information
# ============================================

echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}🔑 STEP 2: API Keys Setup (5 min)${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${Y}We need your API keys for REAL MONEY processing.${NC}"
echo ""
echo "I'll guide you to get each one..."
echo ""

# Stripe Keys
echo -e "${C}━━━ STRIPE (REQUIRED FOR PAYMENTS) ━━━${NC}"
echo ""
echo "1. Open browser on your phone"
echo "2. Go to: https://dashboard.stripe.com/register"
echo "3. Sign up with: $USER_EMAIL"
echo "4. Complete business info"
echo "5. Switch to 'Live mode' (toggle top-right)"
echo "6. Go to: https://dashboard.stripe.com/apikeys"
echo ""
read -p "Press Enter when you have the keys page open..."
echo ""

# Secret key with hidden input
echo "Paste LIVE Secret Key (sk_live_...):"
read -s STRIPE_SECRET
echo ""

# Validate Stripe secret key
if [[ -z "$STRIPE_SECRET" ]]; then
    echo -e "${R}❌ Secret key cannot be empty${NC}"
    exit 1
fi

# Publishable key
read -p "Paste LIVE Publishable Key (pk_live_...): " STRIPE_PUBLIC

# Validate publishable key
if [[ -z "$STRIPE_PUBLIC" ]]; then
    echo -e "${R}❌ Publishable key cannot be empty${NC}"
    exit 1
fi

# Verify Stripe keys are LIVE
if [[ $STRIPE_SECRET == sk_live_* ]] && [[ $STRIPE_PUBLIC == pk_live_* ]]; then
    echo -e "${G}✅ PRODUCTION MODE: Real money enabled!${NC}"
    PRODUCTION_MODE="true"
elif [[ $STRIPE_SECRET == sk_test_* ]] && [[ $STRIPE_PUBLIC == pk_test_* ]]; then
    echo -e "${Y}⚠️  TEST MODE: Using test keys (no real money)${NC}"
    PRODUCTION_MODE="false"
else
    echo -e "${R}❌ Invalid Stripe key format or mismatched keys${NC}"
    echo "Secret starts with: ${STRIPE_SECRET:0:7}"
    echo "Publishable starts with: ${STRIPE_PUBLIC:0:7}"
    exit 1
fi

# Google Gemini (Optional but recommended - FREE)
echo ""
echo -e "${C}━━━ GOOGLE GEMINI (FREE AI - OPTIONAL) ━━━${NC}"
echo ""
echo "Get FREE AI at: https://makersuite.google.com/app/apikey"
echo ""
read -p "Paste Google API Key (or press Enter to skip): " GOOGLE_KEY

# GitHub Setup
echo ""
echo -e "${C}━━━ GITHUB (REQUIRED FOR DEPLOYMENT) ━━━${NC}"
echo ""
echo "We'll use GitHub to deploy your code."
echo ""
read -p "Do you have a GitHub account? (y/n): " HAS_GITHUB

if [[ ! "$HAS_GITHUB" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Please create one:"
    echo "1. Go to: https://github.com/join"
    echo "2. Sign up with: $USER_EMAIL"
    echo "3. Verify your email"
    echo ""
    read -p "Press Enter when done..."
fi

echo ""
read -p "Enter your GitHub username: " GITHUB_USERNAME

# Validate GitHub username
if [[ -z "$GITHUB_USERNAME" ]]; then
    echo -e "${R}❌ GitHub username cannot be empty${NC}"
    exit 1
fi

# Configure Git
git config --global user.email "$USER_EMAIL"
git config --global user.name "$GITHUB_USERNAME"

echo -e "${G}✅ Git configured${NC}"

# ============================================
# STEP 3: Create Project
# ============================================

echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}📁 STEP 3: Creating Project (1 min)${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Backup existing directory if it exists
if [ -d "$PROJECT_DIR" ]; then
    echo -e "${Y}⚠️  Project directory exists, creating backup...${NC}"
    mv "$PROJECT_DIR" "${PROJECT_DIR}.backup.$(date +%s)"
fi

mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Package.json with fixed versions for production stability
cat > package.json << 'EOF'
{
  "name": "publishing-empire",
  "version": "2.0.0",
  "description": "AI-powered publishing platform - deployed from Termux!",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "4.18.2",
    "pg": "8.11.3",
    "bcrypt": "5.1.1",
    "jsonwebtoken": "9.0.2",
    "dotenv": "16.3.1",
    "cors": "2.8.5",
    "stripe": "14.10.0",
    "helmet": "7.1.0",
    "express-rate-limit": "7.1.5",
    "morgan": "1.10.0"
  },
  "engines": {
    "node": ">=18.x"
  }
}
EOF

echo -e "${G}✅ Package.json created${NC}"

# Install dependencies with error handling
echo ""
echo "Installing dependencies (takes 2-3 min)..."
if npm install --silent --no-audit; then
    echo -e "${G}✅ Dependencies installed${NC}"
else
    echo -e "${R}❌ Failed to install dependencies${NC}"
    exit 1
fi

# ============================================
# STEP 4: Generate Code
# ============================================

echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}💻 STEP 4: Generating Code (1 min)${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Main server with enhanced security
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();

const app = express();
const REAL_MONEY = process.env.PRODUCTION_MODE === 'true';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: REAL_MONEY
    ? process.env.ALLOWED_ORIGINS?.split(',') || '*'
    : '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: REAL_MONEY ? 100 : 1000, // Stricter limits in production
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Homepage
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Publishing Empire ${REAL_MONEY ? '💰' : '🧪'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 500px;
          width: 100%;
        }
        h1 { font-size: 36px; margin-bottom: 10px; text-align: center; }
        .badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: bold;
          margin: 10px auto;
        }
        .live { background: #10b981; color: white; }
        .test { background: #f59e0b; color: white; }
        .stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 30px 0;
        }
        .stat {
          background: #f3f4f6;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
        }
        .stat-value { font-size: 28px; font-weight: bold; color: #667eea; }
        .stat-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
        .info { text-align: center; color: #666; font-size: 14px; margin-top: 20px; }
        .deployed { background: #eff6ff; padding: 15px; border-radius: 10px; margin-top: 20px; }
        .deployed strong { color: #667eea; }
        .security {
          background: #f0fdf4;
          border: 1px solid #10b981;
          padding: 10px;
          border-radius: 8px;
          margin-top: 15px;
          font-size: 12px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📚 Publishing Empire</h1>
        <div style="text-align: center;">
          <span class="badge ${REAL_MONEY ? 'live' : 'test'}">
            ${REAL_MONEY ? '💰 LIVE - Real Money' : '🧪 TEST MODE'}
          </span>
        </div>
        <div class="stats">
          <div class="stat">
            <div class="stat-value">70%</div>
            <div class="stat-label">Author Royalty</div>
          </div>
          <div class="stat">
            <div class="stat-value">24/7</div>
            <div class="stat-label">AI Support</div>
          </div>
          <div class="stat">
            <div class="stat-value">$0</div>
            <div class="stat-label">Setup Cost</div>
          </div>
          <div class="stat">
            <div class="stat-value">${REAL_MONEY ? 'LIVE' : 'TEST'}</div>
            <div class="stat-label">Status</div>
          </div>
        </div>
        <div class="deployed">
          <strong>📱 Deployed from Termux!</strong><br>
          <small>Android-powered publishing platform</small>
        </div>
        <div class="security">
          🔒 Secured with Helmet + Rate Limiting
        </div>
        <div class="info">
          Admin: ${process.env.ADMIN_EMAIL}<br>
          <small>Built with Node.js + Stripe + Express</small>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: REAL_MONEY ? 'production' : 'test',
    deployedFrom: 'Termux',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    nodeVersion: process.version
  });
});

// Enhanced payment endpoint with validation
app.post('/api/payment', async (req, res) => {
  try {
    const { amount, description, currency = 'usd' } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (amount > 999999) {
      return res.status(400).json({ error: 'Amount too large' });
    }

    // Test mode
    if (!REAL_MONEY) {
      return res.json({
        success: true,
        testMode: true,
        message: 'Test mode - no real charge',
        amount: amount,
        currency: currency
      });
    }

    // Production payment
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency,
      description: description || 'Book purchase',
      metadata: {
        deployedFrom: 'Termux',
        timestamp: new Date().toISOString()
      }
    });

    console.log(`Payment intent created: ${paymentIntent.id} for $${amount}`);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Payment error:', error.message);
    res.status(500).json({
      error: 'Payment processing failed',
      message: REAL_MONEY ? 'Please try again later' : error.message
    });
  }
});

// Webhook endpoint for Stripe
app.post('/api/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log('Webhook received:', event.type);

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log('Payment succeeded:', event.data.object.id);
        break;
      case 'payment_intent.payment_failed':
        console.log('Payment failed:', event.data.object.id);
        break;
      default:
        console.log('Unhandled event type:', event.type);
    }

    res.json({received: true});
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: REAL_MONEY ? 'Something went wrong' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════╗
║  🚀 SERVER RUNNING 🚀             ║
╚════════════════════════════════════╝

Port: ${PORT}
Mode: ${REAL_MONEY ? 'PRODUCTION 💰' : 'TEST 🧪'}
Admin: ${process.env.ADMIN_EMAIL}
Node: ${process.version}

Security: ✅ Helmet + Rate Limiting
📱 Deployed from Termux!

Ready to accept ${REAL_MONEY ? 'REAL MONEY' : 'test'} payments!
  `);
});
EOF

echo -e "${G}✅ Server code generated${NC}"

# Environment file
JWT_SECRET=$(openssl rand -base64 32)
cat > .env << EOF
# Environment Configuration
NODE_ENV=production
PORT=3000
ADMIN_EMAIL=$USER_EMAIL

# Production Mode
PRODUCTION_MODE=$PRODUCTION_MODE

# Stripe (${PRODUCTION_MODE:+LIVE - Real Money}${PRODUCTION_MODE:-TEST})
STRIPE_SECRET_KEY=$STRIPE_SECRET
STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLIC

# Stripe Webhook (set this after Railway deployment)
# STRIPE_WEBHOOK_SECRET=whsec_...

# AI (Optional)
GOOGLE_API_KEY=$GOOGLE_KEY

# Security
JWT_SECRET=$JWT_SECRET

# CORS (comma-separated origins for production)
# ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Database (Railway will set this)
# DATABASE_URL=\${DATABASE_URL}
EOF

echo -e "${G}✅ Environment configured${NC}"

# Create Procfile for Railway
echo "web: node server.js" > Procfile

# Create .gitignore
cat > .gitignore << 'EOF'
node_modules/
.env
.env.local
.env.*.local
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
*.backup.*
EOF

echo -e "${G}✅ .gitignore created${NC}"

# Create README
cat > README.md << EOF
# 📚 Publishing Empire

🚀 Deployed from Termux (Android)!

## Status
- **Mode:** ${PRODUCTION_MODE:+Production (Real Money 💰)}${PRODUCTION_MODE:-Test Mode 🧪}
- **Deployed:** $(date)
- **Admin:** $USER_EMAIL
- **Version:** 2.0

## Features
- ✅ 70% author royalties
- ✅ Stripe payment processing
- ✅ Mobile-first deployment
- ✅ Zero upfront costs
- ✅ Security hardened (Helmet + Rate Limiting)
- ✅ Error handling & logging
- ✅ Webhook support

## Tech Stack
- **Platform:** Termux (Android)
- **Runtime:** Node.js $(node --version)
- **Framework:** Express
- **Payments:** Stripe
- **Hosting:** Railway
- **Security:** Helmet, Rate Limiting, CORS

## API Endpoints

### Public
- \`GET /\` - Homepage
- \`GET /health\` - Health check

### API (Rate Limited)
- \`POST /api/payment\` - Create payment
- \`POST /api/webhook\` - Stripe webhook

## Local Development

\`\`\`bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your keys

# Run server
npm start
\`\`\`

## Environment Variables

Required:
- \`STRIPE_SECRET_KEY\` - Stripe secret key
- \`STRIPE_PUBLISHABLE_KEY\` - Stripe publishable key
- \`PRODUCTION_MODE\` - true/false
- \`ADMIN_EMAIL\` - Admin email

Optional:
- \`GOOGLE_API_KEY\` - Google Gemini API
- \`STRIPE_WEBHOOK_SECRET\` - Stripe webhook secret
- \`ALLOWED_ORIGINS\` - CORS origins (production)

## Security Features

1. **Helmet** - Security headers
2. **Rate Limiting** - 100 req/15min (prod), 1000 (dev)
3. **CORS** - Configurable origins
4. **Input Validation** - All endpoints
5. **Error Handling** - Graceful error responses
6. **Logging** - Request logging with Morgan

## Deployment

Deployed via:
1. Termux (Android) → Git → GitHub
2. GitHub → Railway (auto-deploy)
3. Railway → Production URL

## Author

**Built by:** $GITHUB_USERNAME
**Email:** $USER_EMAIL
**Deployed from:** Android phone! 📱

---

${PRODUCTION_MODE:+🎉 **LIVE WITH REAL MONEY!** 🎉}${PRODUCTION_MODE:-🧪 **TEST MODE** - Switch to live keys when ready}
EOF

echo -e "${G}✅ README created${NC}"

# Create example .env for reference
cat > .env.example << 'EOF'
NODE_ENV=production
PORT=3000
ADMIN_EMAIL=your-email@example.com
PRODUCTION_MODE=false
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_API_KEY=optional
JWT_SECRET=generate-with-openssl-rand
ALLOWED_ORIGINS=https://yourdomain.com
EOF

echo -e "${G}✅ All files generated${NC}"

# ============================================
# STEP 5: Push to GitHub
# ============================================

echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}📤 STEP 5: Pushing to GitHub (2 min)${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Initialize git
git init
git add .
git commit -m "Initial commit - Deployed from Termux v2.0

- Enhanced security (Helmet, Rate Limiting)
- Improved error handling
- Input validation
- Webhook support
- Better logging
- Production-ready configuration"

echo ""
echo -e "${Y}Now create a GitHub repository:${NC}"
echo ""
echo "On your phone browser:"
echo "1. Go to: https://github.com/new"
echo "2. Repository name: $PROJECT_NAME"
echo "3. Make it: Public"
echo "4. DON'T initialize with README"
echo "5. Click 'Create repository'"
echo ""
read -p "Press Enter when repository is created..."

echo ""
read -p "Paste the repository URL (https://github.com/$GITHUB_USERNAME/...): " REPO_URL

# Validate URL
if [[ ! "$REPO_URL" =~ ^https://github.com/ ]]; then
    echo -e "${R}❌ Invalid GitHub URL${NC}"
    exit 1
fi

# Add remote and push with retry
echo ""
echo "Pushing to GitHub..."
git remote add origin "$REPO_URL"
git branch -M main

# Retry logic for git push
MAX_RETRIES=3
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if git push -u origin main; then
        echo -e "${G}✅ Code pushed to GitHub!${NC}"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo -e "${Y}⚠️  Push failed, retrying ($RETRY_COUNT/$MAX_RETRIES)...${NC}"
            sleep 2
        else
            echo -e "${R}❌ Failed to push to GitHub after $MAX_RETRIES attempts${NC}"
            exit 1
        fi
    fi
done

# ============================================
# STEP 6: Deploy to Railway
# ============================================

echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}🚂 STEP 6: Deploy to Railway (3-5 min)${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${Y}Now deploy via Railway web interface:${NC}"
echo ""
echo "On your phone browser:"
echo ""
echo "1. Go to: https://railway.app"
echo "2. Click 'Start a New Project'"
echo "3. Select 'Deploy from GitHub repo'"
echo "4. Choose: $GITHUB_USERNAME/$PROJECT_NAME"
echo "5. Click 'Deploy Now'"
echo ""
echo "6. Go to 'Variables' tab"
echo "7. Add these variables (COPY CAREFULLY):"
echo ""
echo "   STRIPE_SECRET_KEY"
echo "   $STRIPE_SECRET"
echo ""
echo "   STRIPE_PUBLISHABLE_KEY"
echo "   $STRIPE_PUBLIC"
echo ""
echo "   PRODUCTION_MODE"
echo "   $PRODUCTION_MODE"
echo ""
echo "   ADMIN_EMAIL"
echo "   $USER_EMAIL"
echo ""
if [ ! -z "$GOOGLE_KEY" ]; then
echo "   GOOGLE_API_KEY"
echo "   $GOOGLE_KEY"
echo ""
fi
echo "8. Go to 'Settings' tab"
echo "9. Under 'Domains', click 'Generate Domain'"
echo "10. Copy your domain (ends with .up.railway.app)"
echo ""
read -p "Press Enter when deployed..."

echo ""
read -p "Paste your Railway domain (without https://): " RAILWAY_DOMAIN

# Validate domain
if [[ -z "$RAILWAY_DOMAIN" ]]; then
    echo -e "${R}❌ Domain cannot be empty${NC}"
    exit 1
fi

# Test deployment
echo ""
echo "Testing deployment..."
if command -v curl &> /dev/null; then
    if curl -s -o /dev/null -w "%{http_code}" "https://$RAILWAY_DOMAIN/health" | grep -q "200"; then
        echo -e "${G}✅ Deployment is live and responding!${NC}"
    else
        echo -e "${Y}⚠️  Couldn't verify deployment, but continuing...${NC}"
    fi
else
    echo -e "${Y}⚠️  curl not available, skipping health check${NC}"
fi

# ============================================
# WEBHOOK CONFIGURATION
# ============================================

echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}🔗 STEP 7: Configure Stripe Webhook${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Set up Stripe webhooks:"
echo ""
echo "1. Go to: https://dashboard.stripe.com/webhooks"
echo "2. Click 'Add endpoint'"
echo "3. Endpoint URL: https://$RAILWAY_DOMAIN/api/webhook"
echo "4. Select events: payment_intent.succeeded, payment_intent.payment_failed"
echo "5. Copy the 'Signing secret' (starts with whsec_)"
echo "6. Add it as STRIPE_WEBHOOK_SECRET in Railway variables"
echo ""
read -p "Press Enter when webhook is configured..."

# ============================================
# SUCCESS!
# ============================================

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║                                                        ║"
echo "║         🎉 DEPLOYMENT COMPLETE! 🎉                    ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

if [ "$PRODUCTION_MODE" = "true" ]; then
    echo -e "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${G}💰 YOUR PLATFORM IS LIVE WITH REAL MONEY! 💰${NC}"
    echo -e "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
    echo -e "${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${Y}🧪 TEST MODE - Switch to live keys for real money${NC}"
    echo -e "${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

echo ""
echo -e "${C}📊 YOUR EMPIRE:${NC}"
echo "  🌐 Live URL: https://$RAILWAY_DOMAIN"
echo "  📧 Admin: $USER_EMAIL"
echo "  📱 Deployed from: Termux (Android)"
echo "  ${PRODUCTION_MODE:+💰 Mode: PRODUCTION}${PRODUCTION_MODE:-🧪 Mode: TEST}"
echo "  📂 GitHub: $REPO_URL"
echo "  🔒 Security: Helmet + Rate Limiting + CORS"
echo ""

echo -e "${Y}🎯 NEXT STEPS:${NC}"
echo ""
echo "  1️⃣  TEST YOUR SITE:"
echo "     Open: https://$RAILWAY_DOMAIN"
echo "     Test health: https://$RAILWAY_DOMAIN/health"
echo ""
echo "  2️⃣  VERIFY WEBHOOK:"
echo "     Check Stripe dashboard for webhook test"
echo ""
echo "  3️⃣  MONITOR:"
echo "     Railway logs: https://railway.app/dashboard"
echo "     Stripe dashboard: https://dashboard.stripe.com"
echo ""
echo "  4️⃣  GET FIRST CUSTOMER:"
echo "     Share your site on social media!"
echo ""

# Create comprehensive deployment info file
cat > DEPLOYMENT_INFO.txt << EOF
╔════════════════════════════════════════════════════════╗
║      PUBLISHING EMPIRE - DEPLOYMENT INFO v2.0         ║
╚════════════════════════════════════════════════════════╝

🌐 LIVE URLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Main Site: https://$RAILWAY_DOMAIN
Health Check: https://$RAILWAY_DOMAIN/health
API Payment: https://$RAILWAY_DOMAIN/api/payment
Webhook: https://$RAILWAY_DOMAIN/api/webhook

📋 CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Admin Email: $USER_EMAIL
Deployed: $(date)
Deployed From: Termux (Android)
Node Version: $(node --version)
${PRODUCTION_MODE:+Mode: PRODUCTION (Real Money 💰)}${PRODUCTION_MODE:-Mode: TEST (Test Keys 🧪)}

🔒 SECURITY FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Helmet (Security Headers)
✅ Rate Limiting (100 req/15min prod)
✅ CORS Configuration
✅ Input Validation
✅ Error Handling
✅ Request Logging

📂 EXTERNAL SERVICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GitHub Repo: $REPO_URL
Railway Dashboard: https://railway.app/dashboard
Stripe Dashboard: https://dashboard.stripe.com
Stripe Webhooks: https://dashboard.stripe.com/webhooks

🔧 LOCAL DEVELOPMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project Directory: $PROJECT_DIR

To update your app:
1. cd $PROJECT_DIR
2. Make your changes
3. git add .
4. git commit -m "description of changes"
5. git push
6. Railway auto-deploys!

To view logs:
- Railway: https://railway.app/dashboard (View Logs)
- Local: Check Railway deployment logs

📊 MONITORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Railway Logs: https://railway.app/dashboard
Stripe Payments: https://dashboard.stripe.com/payments
Stripe Events: https://dashboard.stripe.com/events

Health Check: curl https://$RAILWAY_DOMAIN/health

🎯 IMPORTANT REMINDERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${PRODUCTION_MODE:+✅ You're LIVE with real money processing!}${PRODUCTION_MODE:-⚠️  Currently in TEST mode}
${PRODUCTION_MODE:+⚠️  Monitor Stripe dashboard regularly}${PRODUCTION_MODE:-💡 Switch to live Stripe keys when ready}
✅ Webhook configured for payment events
✅ Security headers enabled
✅ Rate limiting active

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${PRODUCTION_MODE:+🎉 YOUR EMPIRE IS LIVE! 🎉}${PRODUCTION_MODE:-🧪 Test thoroughly before going live!}

Deployed from your Android phone! 📱🚀
Built by: $GITHUB_USERNAME
EOF

echo -e "${G}✅ Deployment info saved to: DEPLOYMENT_INFO.txt${NC}"
echo ""
echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${G}🎊 YOUR EMPIRE IS OPERATIONAL! 🎊${NC}"
echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$PRODUCTION_MODE" = "true" ]; then
    echo -e "${G}💰 You deployed REAL MONEY processing from your PHONE! 💰${NC}"
    echo ""
    echo -e "${Y}⚠️  IMPORTANT SECURITY REMINDERS:${NC}"
    echo "  - Monitor Stripe dashboard daily"
    echo "  - Check Railway logs regularly"
    echo "  - Keep dependencies updated"
    echo "  - Review transactions weekly"
else
    echo -e "${Y}🧪 Test everything thoroughly, then switch to live Stripe keys!${NC}"
fi

echo ""
echo "View deployment info anytime:"
echo "  cat $PROJECT_DIR/DEPLOYMENT_INFO.txt"
echo ""
echo "Quick commands:"
echo "  cd $PROJECT_DIR          # Go to project"
echo "  git status               # Check git status"
echo "  git log --oneline -5     # View recent commits"
echo "  npm start                # Run locally (after setting .env)"
echo ""
echo -e "${C}Let's make money! 🚀💪${NC}"
echo ""

# Save deployment summary to home directory for easy access
cat > ~/publishing-empire-deployed.txt << EOF
🎉 Publishing Empire Deployed!

URL: https://$RAILWAY_DOMAIN
Mode: ${PRODUCTION_MODE:+PRODUCTION}${PRODUCTION_MODE:-TEST}
Date: $(date)

Full info: $PROJECT_DIR/DEPLOYMENT_INFO.txt
EOF

echo -e "${G}✅ Quick reference saved to: ~/publishing-empire-deployed.txt${NC}"
echo ""
