# Modal.com Deployment Guide - AI Trader's Shadow Backend

Complete guide for deploying the AI Trader's Shadow backend to Modal.com as a serverless application.

## Table of Contents

1. [Why Modal.com?](#why-modalcom)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Setup](#detailed-setup)
5. [Deployment](#deployment)
6. [Frontend Configuration](#frontend-configuration)
7. [Database Setup](#database-setup)
8. [Monitoring & Logs](#monitoring--logs)
9. [Cost Optimization](#cost-optimization)
10. [Troubleshooting](#troubleshooting)

---

## Why Modal.com?

**Benefits of Modal over traditional VPS:**

✅ **Serverless** - No server management, automatic scaling
✅ **Cost-effective** - Pay only for actual usage (per-second billing)
✅ **Auto-scaling** - Scales from 0 to infinity based on traffic
✅ **Fast deployments** - Deploy in seconds with `modal deploy`
✅ **ML-optimized** - Great for AI/ML workloads (GPU support)
✅ **Built-in secrets** - Secure environment variable management
✅ **Zero DevOps** - No Docker Compose, nginx, SSL certificates to manage

**Trade-offs:**
- ❌ Cold starts (first request after idle)
- ❌ Requires external database (no bundled TimescaleDB)
- ❌ Stateless containers (model reloads on cold start)

**Best for:**
- MVP and early-stage projects
- Variable/unpredictable traffic
- ML inference workloads
- Cost-conscious deployments

---

## Prerequisites

### Required

- **Python 3.10+** installed locally
- **Modal account** (free tier available): https://modal.com
- **Managed database** (Supabase, Neon, Railway, or AWS RDS)
  - We cannot run TimescaleDB in Modal containers
  - Recommended: Neon (free tier with PostgreSQL + TimescaleDB extension)

### Optional

- **GitHub account** (for CI/CD)
- **Vercel account** (for frontend deployment)

---

## Quick Start

### 1. Install Modal CLI

```bash
# Install Modal
pip install modal

# Authenticate
modal setup
```

This opens a browser for authentication.

### 2. Setup Secrets

```bash
cd backend

# Interactive script to create secrets
bash modal_setup_secrets.sh
```

You'll be prompted for:
- **DATABASE_URL** (required) - PostgreSQL connection string
- **SECRET_KEY** (required) - FastAPI secret key (auto-generated if empty)
- **DB_PASSWORD** (required) - Database password
- **EXCHANGE_API_KEY** (optional) - Binance API key
- **TELEGRAM_BOT_TOKEN** (optional) - Telegram bot token

### 3. Test Locally

```bash
# Test in Modal local container
bash modal_deploy.sh test

# Or directly:
modal run app.modal_app
```

### 4. Deploy to Production

```bash
# Deploy to Modal.com
bash modal_deploy.sh deploy

# Or directly:
modal deploy app.modal_app
```

**Output will show your production URL:**
```
✓ Created web function fastapi_app => https://your-org--ai-traders-shadow-backend-web.modal.run
```

### 5. Update Frontend

```bash
# In frontend/.env.local
NEXT_PUBLIC_API_URL=https://your-org--ai-traders-shadow-backend-web.modal.run/api/v1
NEXT_PUBLIC_WS_URL=wss://your-org--ai-traders-shadow-backend-web.modal.run/ws
```

---

## Detailed Setup

### Step 1: Create Modal Account

1. Visit https://modal.com
2. Sign up with GitHub or email
3. Verify email
4. Complete onboarding

**Free tier includes:**
- $30 credits per month
- CPU containers
- Scheduled functions
- Secrets management

### Step 2: Install and Authenticate Modal

```bash
# Install Modal CLI
pip install modal

# Authenticate (opens browser)
modal setup

# Verify authentication
modal profile list
```

### Step 3: Setup Database

Modal containers are stateless, so we need an external managed database.

**Recommended: Neon (PostgreSQL with TimescaleDB)**

1. Visit https://neon.tech
2. Create account (free tier)
3. Create new project: "ai-traders-shadow"
4. Enable TimescaleDB extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS timescaledb;
   ```
5. Copy connection string:
   ```
   postgresql://user:password@host.neon.tech:5432/ai_traders_shadow?sslmode=require
   ```
6. Run schema initialization:
   ```bash
   psql "postgresql://user:password@host.neon.tech:5432/ai_traders_shadow?sslmode=require" < database/schema.sql
   ```

**Alternative: Supabase**

1. Visit https://supabase.com
2. Create project
3. Get connection string from Settings > Database
4. Run schema script

**Alternative: Railway**

1. Visit https://railway.app
2. Create new PostgreSQL database
3. Get connection string
4. Run schema script

### Step 4: Create Modal Secrets

**Option A: Interactive Script (Recommended)**

```bash
cd backend
bash modal_setup_secrets.sh
```

**Option B: Manual CLI**

```bash
modal secret create ai-traders-shadow-secrets \
    DATABASE_URL="postgresql://user:pass@host:5432/db" \
    SECRET_KEY="your-32-char-secret-key" \
    DB_PASSWORD="your-db-password" \
    EXCHANGE_API_KEY="optional-binance-key" \
    EXCHANGE_API_SECRET="optional-binance-secret" \
    TELEGRAM_BOT_TOKEN="optional-telegram-token" \
    TELEGRAM_ADMIN_CHAT_ID="optional-chat-id" \
    CORS_ORIGINS='["https://yourdomain.com"]' \
    DEBUG="false" \
    API_HOST="0.0.0.0" \
    API_PORT="8000" \
    MODEL_PATH="/app/models"
```

**Option C: Modal Dashboard**

1. Visit https://modal.com/secrets
2. Click "New Secret"
3. Name: `ai-traders-shadow-secrets`
4. Add key-value pairs
5. Save

**Verify secrets:**

```bash
modal secret list
```

### Step 5: Verify ML Model

```bash
# Check model exists
ls -lh backend/models/ppo_crypto_final.zip

# If missing, train model:
cd backend
python -m app.ml.train_ppo
```

The model will be bundled into the Docker image during deployment.

---

## Deployment

### Test Deployment (Local Modal Container)

```bash
cd backend

# Test with script
bash modal_deploy.sh test

# Or directly
modal run app.modal_app
```

**What happens:**
1. Builds Docker image locally
2. Starts Modal container with your code
3. Runs FastAPI app
4. Provides local URL (e.g., `http://localhost:8000`)

**Test endpoints:**
```bash
# Health check
curl http://localhost:8000/

# API docs
open http://localhost:8000/docs

# ML prediction
curl http://localhost:8000/api/v1/prediction/predict/BTC-USDT
```

### Production Deployment

```bash
cd backend

# Deploy with script
bash modal_deploy.sh deploy

# Or directly
modal deploy app.modal_app
```

**What happens:**
1. Builds Docker image (includes ML model)
2. Pushes to Modal registry
3. Deploys as ASGI web app
4. Provides production URL

**Output:**
```
✓ Created app ai-traders-shadow-backend
✓ Created web function fastapi_app => https://your-org--ai-traders-shadow-backend-web.modal.run
```

**Test production:**
```bash
# Replace with your actual URL
API_URL="https://your-org--ai-traders-shadow-backend-web.modal.run"

# Health check
curl $API_URL/

# API health
curl $API_URL/api/v1/health

# API docs (if DEBUG=true)
open $API_URL/docs
```

### Update Deployment

```bash
# Make code changes
git pull origin main

# Redeploy
modal deploy app.modal_app
```

Modal will build and deploy the new version (takes ~1-2 minutes).

---

## Frontend Configuration

### Update Environment Variables

**Local development (frontend/.env.local):**

```bash
NEXT_PUBLIC_API_URL=https://your-org--ai-traders-shadow-backend-web.modal.run/api/v1
NEXT_PUBLIC_WS_URL=wss://your-org--ai-traders-shadow-backend-web.modal.run/ws
```

**Vercel production:**

1. Go to Vercel project settings
2. Environment Variables
3. Add:
   - `NEXT_PUBLIC_API_URL` = `https://your-org--ai-traders-shadow-backend-web.modal.run/api/v1`
   - `NEXT_PUBLIC_WS_URL` = `wss://your-org--ai-traders-shadow-backend-web.modal.run/ws`
4. Redeploy

### Update CORS Origins

Update Modal secrets to allow your frontend domain:

```bash
modal secret create ai-traders-shadow-secrets \
    CORS_ORIGINS='["https://your-frontend.vercel.app", "https://yourdomain.com"]' \
    --force
```

Then redeploy:

```bash
modal deploy app.modal_app
```

---

## Database Setup

### Schema Initialization

**If using Neon/Supabase/Railway:**

```bash
# Get your database connection string
DB_URL="postgresql://user:password@host:5432/db"

# Run schema script
psql "$DB_URL" < database/schema.sql

# Verify tables
psql "$DB_URL" -c "\dt"
```

**Expected tables:**
- `users`
- `trades_paper`
- `market_data_1m` (hypertable)
- `order_book_snapshots` (hypertable)
- `agent_status_log` (hypertable)
- `pre_trade_checks_log` (hypertable)

### Connection Pooling

Modal containers are ephemeral. Use connection pooling in your database:

**Neon:**
- Automatically includes PgBouncer connection pooling
- Use the "Pooled connection" string from dashboard

**Supabase:**
- Transaction pooler: Port 6543
- Session pooler: Port 5432
- Use transaction pooler for better performance

**Railway:**
- No built-in pooling
- Consider adding PgBouncer as a separate service

### Database Migrations

```bash
# If using Alembic (optional)
cd backend
alembic upgrade head
```

---

## Monitoring & Logs

### View Logs

```bash
# Live logs (follow)
modal app logs ai-traders-shadow-backend --follow

# Recent logs
modal app logs ai-traders-shadow-backend

# Filter by function
modal app logs ai-traders-shadow-backend --function fastapi_app
```

### Check Status

```bash
# List apps
modal app list

# Check if running
modal app list | grep ai-traders-shadow-backend
```

### Dashboard

Visit Modal dashboard: https://modal.com/apps

You'll see:
- Active containers
- Request metrics
- Error rates
- Container stats (CPU, memory)
- Cost breakdown

### Alerts

Modal dashboard provides:
- Error alerts (email/Slack)
- Usage alerts
- Cost alerts

Configure in: https://modal.com/settings/alerts

---

## Cost Optimization

### Container Idle Timeout

```python
# In backend/app/modal_app.py
@app.function(
    container_idle_timeout=300,  # 5 minutes (keeps model warm)
    # Adjust based on traffic:
    # - 60 seconds: Low traffic, cost-sensitive
    # - 300 seconds: Medium traffic, balance cost and performance
    # - 600 seconds: High traffic, keep model always warm
)
```

**Trade-off:**
- **Longer timeout:** Less cold starts, faster responses, higher cost
- **Shorter timeout:** More cold starts, slower responses, lower cost

### Memory and CPU

```python
@app.function(
    memory=2048,  # 2GB RAM (for ML model)
    cpu=2.0,      # 2 CPU cores
)
```

**Optimize:**
- Reduce memory if model is small (<500MB): `memory=1024`
- Reduce CPU if not compute-intensive: `cpu=1.0`

### Request Concurrency

```python
@app.function(
    allow_concurrent_inputs=100,  # 100 concurrent requests per container
)
```

**Higher concurrency = fewer containers = lower cost**

But balance with performance (too high = slow responses).

### Scheduled Functions

```python
# Replace always-on tasks with scheduled functions
@app.function(
    schedule=modal.Cron("*/5 * * * *"),  # Every 5 minutes
)
def scheduled_task():
    # Health checks, data updates, etc.
    pass
```

**Free:** Scheduled functions don't count towards container idle time.

### Scale to Zero

Modal automatically scales to zero when no requests.

**Cost when idle:** $0/month

**No need for:**
- Always-on VPS
- Load balancers
- Auto-scaling groups

### Monitoring Costs

Check costs in Modal dashboard: https://modal.com/usage

**Free tier:** $30/month credits

**Typical costs (after free tier):**
- CPU container: $0.000046/second (~$3.96/day for 24/7)
- Memory: $0.000007/GB-second
- Cold starts: Free
- Network: Free (within Modal)

**Example calculation:**
- 1000 requests/day
- 200ms avg response time
- 2GB memory, 2 CPU
- 300s idle timeout

**Cost:** ~$5-10/month (well within free tier)

---

## Troubleshooting

### Deployment Issues

**Issue:** `modal: command not found`

```bash
# Install Modal
pip install modal

# Or with pipx
pipx install modal
```

**Issue:** "Not authenticated"

```bash
# Authenticate
modal setup

# Verify
modal profile list
```

**Issue:** "Secret not found: ai-traders-shadow-secrets"

```bash
# List secrets
modal secret list

# Create secret
bash backend/modal_setup_secrets.sh
```

**Issue:** "Dockerfile not found"

```bash
# Check Dockerfile exists
ls backend/Dockerfile

# Check you're in the right directory
cd backend
modal deploy app.modal_app
```

### Runtime Issues

**Issue:** "ML model not found"

```bash
# Check model exists
ls backend/models/ppo_crypto_final.zip

# Train model if missing
cd backend
python -m app.ml.train_ppo
```

**Issue:** "Database connection failed"

```bash
# Test connection locally
psql "postgresql://user:pass@host:5432/db"

# Check DATABASE_URL in secrets
modal secret list

# Update if wrong
modal secret create ai-traders-shadow-secrets \
    DATABASE_URL="postgresql://correct-url" \
    --force
```

**Issue:** "CORS errors in frontend"

```bash
# Update CORS_ORIGINS in secrets
modal secret create ai-traders-shadow-secrets \
    CORS_ORIGINS='["https://your-frontend.vercel.app"]' \
    --force

# Redeploy
modal deploy app.modal_app
```

**Issue:** "Cold starts are slow"

```python
# Increase container_idle_timeout in modal_app.py
@app.function(
    container_idle_timeout=600,  # 10 minutes
)
```

**Issue:** "Out of memory"

```python
# Increase memory in modal_app.py
@app.function(
    memory=4096,  # 4GB RAM
)
```

### Log Analysis

```bash
# Check error logs
modal app logs ai-traders-shadow-backend | grep -i error

# Check cold starts
modal app logs ai-traders-shadow-backend | grep -i "loading model"

# Check request timing
modal app logs ai-traders-shadow-backend | grep -i "completed"
```

### Health Checks

```bash
# Backend health
curl https://your-url.modal.run/

# API health
curl https://your-url.modal.run/api/v1/health

# ML model status (check logs)
modal app logs ai-traders-shadow-backend | grep -i "model"
```

---

## Comparison: Modal vs VPS

| Feature | Modal.com | Traditional VPS |
|---------|-----------|-----------------|
| **Setup Time** | 5 minutes | 30-60 minutes |
| **Cost (idle)** | $0 | $10-50/month |
| **Cost (traffic)** | Pay-per-use | Fixed |
| **Scaling** | Automatic | Manual |
| **SSL/HTTPS** | Automatic | Manual (Certbot) |
| **Monitoring** | Built-in dashboard | Setup required |
| **Database** | External (managed) | Self-hosted (TimescaleDB) |
| **DevOps** | Zero | High |
| **Cold Starts** | Yes (~2-5s) | No |
| **GPU Support** | Easy (add `gpu="T4"`) | Complex |

**Use Modal when:**
- MVP or early-stage project
- Variable traffic patterns
- Want zero DevOps
- Budget-conscious
- Need ML/GPU workloads

**Use VPS when:**
- High, consistent traffic
- Need full control
- Want bundled database
- Sub-100ms latency critical
- Complex networking requirements

---

## Next Steps

1. ✅ **Deploy backend** to Modal.com
2. ✅ **Get production URL** from Modal output
3. ✅ **Deploy frontend** to Vercel
   ```bash
   cd frontend
   vercel --prod
   ```
4. ✅ **Update frontend env vars** with Modal backend URL
5. ✅ **Test end-to-end** (frontend → Modal backend → database)
6. ✅ **Monitor logs** and optimize costs
7. ✅ **Setup alerts** in Modal dashboard

---

## Summary

**Deployment Steps:**
1. `pip install modal && modal setup`
2. `bash backend/modal_setup_secrets.sh`
3. `bash backend/modal_deploy.sh deploy`
4. Update frontend with production URL
5. Deploy frontend to Vercel

**Total Time:** ~10-15 minutes from scratch to production! 🚀

**Production URL:**
```
https://your-org--ai-traders-shadow-backend-web.modal.run
```

**Frontend Environment:**
```bash
NEXT_PUBLIC_API_URL=https://your-org--ai-traders-shadow-backend-web.modal.run/api/v1
NEXT_PUBLIC_WS_URL=wss://your-org--ai-traders-shadow-backend-web.modal.run/ws
```

**Monitoring:**
```bash
modal app logs ai-traders-shadow-backend --follow
```

**Cost:** ~$5-10/month (within free tier for most MVP traffic)

---

**Your AI Trader's Shadow backend is now serverless! ☁️🚀**
