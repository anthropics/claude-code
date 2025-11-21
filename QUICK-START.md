# 🚀 AI Trader's Shadow - Quick Start Guide

**Ready to deploy in 3 commands!**

---

## ⚡ Fastest Path to Production

### Option 1: Automated Deployment (Recommended)

```bash
# Download and run the deployment script
cd ~/claude-code
chmod +x DEPLOY-NOW.sh
./DEPLOY-NOW.sh
```

**What it does:**
1. ✅ Authenticates with Modal
2. ✅ Sets up Supabase database
3. ✅ Trains PPO model
4. ✅ Deploys backend to Modal
5. ✅ Pushes code to GitHub

**Time:** ~10 minutes

---

### Option 2: Manual Step-by-Step

```bash
# 1. Setup Modal
modal token set \
  --token-id ak-Udk1F0hH12N3WuCiXOeevw \
  --token-secret as-gJNmbNRC0pO6CCmG00Ze9E

# 2. Setup Database
export DATABASE_URL="postgresql://postgres:Shadow19*@db.rjkcbdvnnzfqgxgwlabi.supabase.co:5432/postgres"
cd ~/claude-code/ai-traders-shadow
psql $DATABASE_URL -f database/schema.sql
psql $DATABASE_URL -f database/migrations/001_add_expert_demonstrations.sql

# 3. Configure Secrets
cd ~/claude-code/ai-traders-shadow/backend
modal secret create ai-traders-shadow-secrets \
  DATABASE_URL="$DATABASE_URL" \
  SECRET_KEY="$(openssl rand -hex 32)" \
  DB_PASSWORD="Shadow19*"

# 4. Train Model
python3 -m app.ml.train_ppo

# 5. Deploy
modal deploy app.modal_app
```

---

## 🔗 Your Credentials (Pre-Configured)

### Modal.com
```
Token ID: ak-Udk1F0hH12N3WuCiXOeevw
Token Secret: as-gJNmbNRC0pO6CCmG00Ze9E
```

### Supabase Database
```
URL: https://rjkcbdvnnzfqgxgwlabi.supabase.co
Database: postgresql://postgres:Shadow19*@db.rjkcbdvnnzfqgxgwlabi.supabase.co:5432/postgres
Password: Shadow19*
```

### GitHub
```
Repository: https://github.com/bagussundaru/claude-trading
SSH Key: Trading Bot Server (already configured)
```

---

## 📱 After Deployment

### Push to GitHub

```bash
cd ~/claude-code
./PUSH-TO-GITHUB.sh
```

### Deploy Frontend to Vercel

```bash
cd ~/claude-code/ai-traders-shadow/frontend
npm install -g vercel
vercel

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_API_URL = https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run
# NEXT_PUBLIC_WS_URL = wss://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run
```

### Test Your Deployment

```bash
# Health check
curl https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run/health

# Model status
curl https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run/api/v1/prediction/model/health?strategy=PPO

# Get prediction
curl https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run/api/v1/prediction/predict/BTC-USDT?strategy=PPO
```

---

## 🧪 10-Minute Smoke Test

1. Open your frontend URL
2. Verify components load:
   - ✅ Mood Meter active
   - ✅ Strategy Selector (PPO selected, GAIL locked 🔒)
   - ✅ AI Recommendation shows action
   - ✅ Trade Panel ready
3. Execute 1 BUY trade
4. Execute 1 SELL trade (wait 10 seconds)
5. Verify in database:
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM expert_demonstrations ORDER BY created_at DESC LIMIT 3;"
   ```

---

## 📚 Full Documentation

- **DEPLOYMENT-READY.md** - Complete deployment guide
- **E2E-TEST-PLAN.md** - Testing procedures (1,057 lines)
- **GAIL-IMPLEMENTATION.md** - GAIL training guide
- **MODAL-DEPLOYMENT.md** - Modal documentation
- **VPS-DEPLOYMENT.md** - Alternative VPS deployment

---

## 🎯 Expected Results

After running `./DEPLOY-NOW.sh`:

```
✅ Modal authenticated
✅ Database tables created (expert_demonstrations, trades_paper, users, etc.)
✅ PPO model trained (models/ppo_crypto_final.zip)
✅ Backend deployed to Modal
✅ Code pushed to GitHub

🎉 Your backend URL:
https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run
```

---

## 🆘 Troubleshooting

### Modal Connection Issues
```bash
# Verify authentication
modal profile list

# Check deployment logs
modal app logs ai-traders-shadow-backend
```

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Check tables
psql $DATABASE_URL -c "\dt"
```

### Model Not Loading
```bash
# Verify model exists
ls -lh ~/claude-code/ai-traders-shadow/backend/models/

# Retrain if needed
cd ~/claude-code/ai-traders-shadow/backend
python3 -m app.ml.train_ppo
```

---

## 🎉 Success!

When you see:
```
✅ Backend deployed successfully!
🎉 Your backend is live at:
   https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run
```

**You're done!** Deploy frontend to Vercel and start trading! 🚀

---

## 💡 Next Steps

1. **Week 1:** Collect 100+ expert demonstrations
2. **Week 2:** Train GAIL model
3. **Week 3:** Unlock GAIL for premium users
4. **Week 4:** Launch monetization (Stripe subscription)

**Your Data Flywheel starts now!** 🌱→🌳
