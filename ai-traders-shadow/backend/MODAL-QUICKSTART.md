# Modal.com Quick Start - AI Trader's Shadow Backend

5-minute guide to deploy backend to Modal.com.

## Prerequisites

- Python 3.10+ installed
- Modal account (sign up at https://modal.com)
- Managed PostgreSQL database (Neon, Supabase, or Railway)

---

## Step 1: Install Modal (1 minute)

```bash
pip install modal
modal setup
```

This opens a browser for authentication.

---

## Step 2: Setup Secrets (2 minutes)

```bash
cd backend
bash modal_setup_secrets.sh
```

**Required inputs:**
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: Auto-generated if left empty
- `DB_PASSWORD`: Your database password

**Optional inputs:** (press Enter to skip)
- `EXCHANGE_API_KEY`: Binance API key
- `TELEGRAM_BOT_TOKEN`: Telegram bot token

---

## Step 3: Deploy (2 minutes)

```bash
# Test locally first (optional)
bash modal_deploy.sh test

# Deploy to production
bash modal_deploy.sh deploy
```

**Output will show:**
```
✓ Created web function fastapi_app => https://your-org--ai-traders-shadow-backend-web.modal.run
```

**Copy this URL!** ☝️

---

## Step 4: Update Frontend

```bash
# In frontend/.env.local
NEXT_PUBLIC_API_URL=https://your-org--ai-traders-shadow-backend-web.modal.run/api/v1
NEXT_PUBLIC_WS_URL=wss://your-org--ai-traders-shadow-backend-web.modal.run/ws
```

---

## Test Your API

```bash
# Health check
curl https://your-org--ai-traders-shadow-backend-web.modal.run/

# API docs
open https://your-org--ai-traders-shadow-backend-web.modal.run/docs
```

---

## View Logs

```bash
# Live logs
modal app logs ai-traders-shadow-backend --follow

# Recent logs
modal app logs ai-traders-shadow-backend
```

---

## Update/Redeploy

```bash
# Make code changes, then:
modal deploy app.modal_app
```

---

## Cost

**Free tier:** $30/month credits

**Typical MVP:** $5-10/month (within free tier)

**Cost when idle:** $0

---

## Common Commands

```bash
# Deploy
modal deploy app.modal_app

# Test locally
modal run app.modal_app

# View logs
modal app logs ai-traders-shadow-backend --follow

# Check status
modal app list

# Update secrets
bash modal_setup_secrets.sh

# Stop app
modal app stop ai-traders-shadow-backend
```

---

## Database Setup

**Using Neon (recommended):**

1. Create account at https://neon.tech
2. Create project: "ai-traders-shadow"
3. Enable TimescaleDB:
   ```sql
   CREATE EXTENSION IF NOT EXISTS timescaledb;
   ```
4. Run schema:
   ```bash
   psql "your-connection-string" < database/schema.sql
   ```

**Connection string format:**
```
postgresql://user:password@host.neon.tech:5432/ai_traders_shadow?sslmode=require
```

---

## Troubleshooting

**"Secret not found"**
```bash
bash modal_setup_secrets.sh
```

**"ML model not found"** (optional)
```bash
python -m app.ml.train_ppo
```

**"Database connection failed"**
- Check DATABASE_URL in secrets
- Test connection: `psql "your-connection-string"`

**"CORS errors"**
```bash
# Update CORS_ORIGINS in secrets
modal secret create ai-traders-shadow-secrets \
    CORS_ORIGINS='["https://your-frontend.vercel.app"]' \
    --force

# Redeploy
modal deploy app.modal_app
```

---

## Next Steps

1. ✅ Backend deployed to Modal.com
2. ⬜ Deploy frontend to Vercel
3. ⬜ Test end-to-end
4. ⬜ Monitor logs and optimize

---

**Total Time:** ~5 minutes from install to production! 🚀

**For detailed guide, see:** [MODAL-DEPLOYMENT.md](../MODAL-DEPLOYMENT.md)
