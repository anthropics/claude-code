# 🐳 Docker Quick Start - AI Trader's Shadow

**Paling mudah - hanya butuh Docker!**

---

## ⚡ Super Quick Start (5 Menit)

### 1. Install Docker Desktop

Download: https://www.docker.com/products/docker-desktop/

**Windows:**
- Download installer
- Double-click install
- **Restart computer**
- Open Docker Desktop dari Start Menu
- Wait sampai icon di system tray hijau ✅

**Verify:**
```powershell
docker --version
```

---

### 2. Clone Repository

```powershell
git clone https://github.com/bagussundaru/claude-code.git
cd claude-code
git checkout claude/ai-trader-shadow-mvp-setup-011CV55RbJpsFUXgSbmjzmbd
cd ai-traders-shadow
```

---

### 3. Setup Database (One-Time)

**Option A: Via Python Script (Recommended)**

```powershell
# Install psycopg2
pip install psycopg2-binary

# Run setup
python setup_database.py
```

**Option B: Via Supabase Dashboard**

1. Go to: https://supabase.com/dashboard/project/rjkcbdvnnzfqgxgwlabi
2. Click "SQL Editor"
3. Copy-paste content dari `database/schema.sql` → Run
4. Copy-paste content dari `database/migrations/001_add_expert_demonstrations.sql` → Run

---

### 4. Start Everything! 🚀

**Option A: Double-Click (Windows)**

```
Double-click: START-DOCKER.bat
```

**Option B: PowerShell**

```powershell
.\START-DOCKER.ps1
```

**Option C: Manual Command**

```powershell
docker-compose -f docker-compose.local.yml up --build
```

---

### 5. Access Application

**Frontend:** http://localhost:3000

**Backend API:** http://localhost:8000/docs

**That's it!** 🎉

---

## 🛑 Stop Application

**Press:** `Ctrl + C` in terminal

**OR:**

```powershell
docker-compose -f docker-compose.local.yml down
```

---

## 🎯 Daily Usage

### Start (Background Mode)
```powershell
docker-compose -f docker-compose.local.yml up -d
```

### Stop
```powershell
docker-compose -f docker-compose.local.yml down
```

### View Logs
```powershell
docker-compose -f docker-compose.local.yml logs -f
```

### Restart
```powershell
docker-compose -f docker-compose.local.yml restart
```

---

## ✅ Verify Everything Works

### Check Services Running
```powershell
docker ps
```

**Should see:**
```
ai-trader-backend    Up
ai-trader-frontend   Up
```

### Test Backend
```
http://localhost:8000/health
```

**Should return:**
```json
{"status":"healthy"}
```

### Test Frontend
```
http://localhost:3000
```

**Should display:**
- ✅ Dashboard with Mood Meter
- ✅ Strategy Selector (PPO selected, GAIL locked 🔒)
- ✅ AI Recommendation
- ✅ Trade Panel
- ✅ Green "Connected" indicator

---

## 🔧 Troubleshooting

### "Port already in use"

**Find & kill process:**
```powershell
# Find process on port 8000
netstat -ano | findstr :8000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

**Or change port in `docker-compose.local.yml`:**
```yaml
ports:
  - "8080:8000"  # Use 8080 instead
```

---

### "Docker daemon not running"

**Solution:**
1. Open Docker Desktop
2. Wait for green icon in system tray
3. Try command again

---

### "Cannot connect to database"

**Verify credentials in `docker-compose.local.yml`:**
```yaml
- DATABASE_URL=postgresql://postgres:Shadow19*@db.rjkcbdvnnzfqgxgwlabi.supabase.co:5432/postgres
```

**Test connection:**
```powershell
python setup_database.py
```

---

### "Frontend can't reach backend"

**Check `docker-compose.local.yml`:**
```yaml
frontend:
  environment:
    - NEXT_PUBLIC_API_URL=http://localhost:8000
    - NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

**Restart:**
```powershell
docker-compose -f docker-compose.local.yml restart
```

---

## 📊 What's Included

**This Docker setup includes:**
- ✅ Backend (FastAPI + Python 3.11)
- ✅ Frontend (Next.js + React)
- ✅ Auto-reload on code changes
- ✅ Health checks
- ✅ Network isolation
- ✅ Volume mounting for development

**What's NOT included:**
- ❌ Local PostgreSQL (using Supabase instead)
- ❌ Redis (not needed for MVP)
- ❌ Nginx (not needed for development)

---

## 🚀 Advanced Commands

### Rebuild After Code Changes
```powershell
docker-compose -f docker-compose.local.yml up --build
```

### Clean Everything
```powershell
docker-compose -f docker-compose.local.yml down -v
docker system prune -a
```

### Access Container Shell
```powershell
# Backend
docker exec -it ai-trader-backend bash

# Frontend
docker exec -it ai-trader-frontend sh
```

### View Real-time Logs
```powershell
# All services
docker-compose -f docker-compose.local.yml logs -f

# Backend only
docker-compose -f docker-compose.local.yml logs -f backend

# Frontend only
docker-compose -f docker-compose.local.yml logs -f frontend
```

---

## 💡 Pro Tips

1. **Use Docker Desktop Dashboard** for easier management
2. **Allocate more resources**: Docker Desktop → Settings → Resources
3. **Enable "Automatically start Docker"** in settings
4. **Use background mode** (`-d`) for development
5. **Check logs** if something doesn't work

---

## 📚 Full Documentation

For more details, see:
- `DOCKER-DEPLOYMENT.md` - Complete Docker guide
- `WINDOWS-DEPLOYMENT-GUIDE.md` - Windows-specific guide
- `DEPLOYMENT-READY.md` - Production deployment

---

## 🎉 Success!

If you can access http://localhost:3000 and see the dashboard, **you're all set!**

**No Python needed. No Node.js needed. Just Docker!** 🐳

---

**Questions?** Check `DOCKER-DEPLOYMENT.md` for full troubleshooting guide.

**Happy Trading!** 🚀
