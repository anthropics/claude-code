# 🐳 Docker Deployment - AI Trader's Shadow

**One-Command Deployment untuk Development**

---

## 🎯 Keuntungan Docker Deployment

✅ **No Python Installation Required**
✅ **No Node.js Installation Required**
✅ **No PostgreSQL Client Required**
✅ **Works on Windows, Mac, Linux**
✅ **Reproducible Environment**
✅ **One Command to Start Everything**

---

## 📋 Prerequisites (Only Docker!)

### Install Docker Desktop untuk Windows

1. **Download Docker Desktop:**
   - Go to: https://www.docker.com/products/docker-desktop/
   - Download untuk Windows

2. **Install Docker Desktop:**
   - Run installer
   - Follow installation steps
   - **Restart computer** when prompted

3. **Verify Installation:**
   ```powershell
   docker --version
   # Output: Docker version 24.x.x

   docker-compose --version
   # Output: Docker Compose version v2.x.x
   ```

4. **Start Docker Desktop:**
   - Open Docker Desktop dari Start Menu
   - Wait sampai Docker running (icon di system tray berubah hijau)

---

## 🚀 ONE-COMMAND DEPLOYMENT

### Step 1: Clone Repository (jika belum)

```powershell
# Clone repository
git clone https://github.com/bagussundaru/claude-code.git
cd claude-code
git checkout claude/ai-trader-shadow-mvp-setup-011CV55RbJpsFUXgSbmjzmbd
```

### Step 2: Navigate ke Project

```powershell
cd ai-traders-shadow
```

### Step 3: Setup Database (One-Time)

**Jalankan database setup script:**

```powershell
# Install psycopg2 (hanya sekali)
pip install psycopg2-binary

# Run setup
python setup_database.py
```

**Expected Output:**
```
🚀 Setting up AI Trader's Shadow Database
============================================================
📡 Connecting to Supabase...
✅ Connected successfully!
📋 Creating database schema...
✅ database/schema.sql executed successfully
🔄 Running migrations...
✅ database/migrations/001_add_expert_demonstrations.sql executed successfully
🎉 Database setup completed successfully!
```

**ATAU Setup via Supabase Dashboard (Alternative):**

1. Go to: https://supabase.com/dashboard/project/rjkcbdvnnzfqgxgwlabi
2. Click "SQL Editor"
3. Copy content dari `database/schema.sql`, paste, dan Run
4. Copy content dari `database/migrations/001_add_expert_demonstrations.sql`, paste, dan Run

### Step 4: Start Everything! 🚀

```powershell
# ONE COMMAND - Start semua services!
docker-compose -f docker-compose.local.yml up --build
```

**Wait for these messages:**
```
✓ Container ai-trader-backend   Created
✓ Container ai-trader-frontend  Created
ai-trader-backend   | INFO:     Application startup complete.
ai-trader-backend   | INFO:     Uvicorn running on http://0.0.0.0:8000
ai-trader-frontend  | ready - started server on 0.0.0.0:3000
ai-trader-frontend  | ✓ Ready in 3.2s
```

**That's it!** 🎉

### Step 5: Access Your Application

**Frontend:**
```
http://localhost:3000
```

**Backend API:**
```
http://localhost:8000/docs
```

**Backend Health:**
```
http://localhost:8000/health
```

---

## 🎮 Docker Commands Cheatsheet

### Start Application (Background Mode)
```powershell
docker-compose -f docker-compose.local.yml up -d
```

### Stop Application
```powershell
docker-compose -f docker-compose.local.yml down
```

### View Logs
```powershell
# All services
docker-compose -f docker-compose.local.yml logs -f

# Backend only
docker-compose -f docker-compose.local.yml logs -f backend

# Frontend only
docker-compose -f docker-compose.local.yml logs -f frontend
```

### Restart Services
```powershell
# Restart all
docker-compose -f docker-compose.local.yml restart

# Restart backend only
docker-compose -f docker-compose.local.yml restart backend
```

### Rebuild (after code changes)
```powershell
docker-compose -f docker-compose.local.yml up --build
```

### Clean Everything
```powershell
# Stop and remove containers, networks
docker-compose -f docker-compose.local.yml down

# Remove all (including volumes - CAREFUL!)
docker-compose -f docker-compose.local.yml down -v
```

### Check Running Containers
```powershell
docker ps
```

### Access Container Shell
```powershell
# Backend shell
docker exec -it ai-trader-backend bash

# Frontend shell
docker exec -it ai-trader-frontend sh
```

---

## 🔧 Customization

### Change Environment Variables

Edit `docker-compose.local.yml`:

```yaml
services:
  backend:
    environment:
      - DATABASE_URL=postgresql://your-connection-string
      - SECRET_KEY=your-secret-key
      - BINANCE_API_KEY=your-api-key
```

### Change Ports

```yaml
services:
  backend:
    ports:
      - "8080:8000"  # Host:Container

  frontend:
    ports:
      - "3001:3000"  # Host:Container
```

### Add More Services

```yaml
services:
  # Example: Add Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

---

## ✅ Verification Checklist

### 1. Check Services Running
```powershell
docker ps
```

**Expected Output:**
```
CONTAINER ID   IMAGE                 STATUS         PORTS
abc123def456   ai-trader-backend     Up 2 minutes   0.0.0.0:8000->8000/tcp
def789ghi012   ai-trader-frontend    Up 2 minutes   0.0.0.0:3000->3000/tcp
```

### 2. Test Backend
```powershell
# Health check
curl http://localhost:8000/health

# Expected: {"status":"healthy"}

# API docs
# Open browser: http://localhost:8000/docs
```

### 3. Test Frontend
```
Open browser: http://localhost:3000

Verify:
✅ Dashboard loads
✅ Mood Meter displays
✅ Strategy Selector shows (PPO selected, GAIL locked)
✅ AI Recommendation appears
✅ Trade Panel ready
```

### 4. Test WebSocket Connection
```
Frontend should show:
✅ Green indicator: "Connected"
✅ No WebSocket errors in browser console (F12)
```

### 5. Test Database Connection
```powershell
# Check backend logs
docker-compose -f docker-compose.local.yml logs backend | grep -i "database"

# Should NOT show connection errors
```

---

## 🐛 Troubleshooting

### Issue 1: "Port already in use"

**Problem:** Port 8000 or 3000 already used

**Solution:**
```powershell
# Find process using port
netstat -ano | findstr :8000
netstat -ano | findstr :3000

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or change port in docker-compose.local.yml
```

### Issue 2: Docker Desktop not starting

**Solution:**
1. Restart Docker Desktop
2. Check WSL 2 installed: `wsl --version`
3. If needed: `wsl --update`
4. Enable Hyper-V in Windows Features

### Issue 3: "Cannot connect to Docker daemon"

**Solution:**
```powershell
# Restart Docker Desktop
# Wait for green icon in system tray

# Verify
docker ps
```

### Issue 4: Frontend can't connect to backend

**Solution:**
```powershell
# Check both containers running
docker ps

# Check backend health
curl http://localhost:8000/health

# Check frontend env vars in docker-compose.local.yml:
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### Issue 5: Database connection failed

**Solution:**
```powershell
# Verify Supabase credentials in docker-compose.local.yml
# Test connection from host:
python setup_database.py

# Check backend logs:
docker-compose -f docker-compose.local.yml logs backend
```

### Issue 6: Build failed - disk space

**Solution:**
```powershell
# Clean Docker cache
docker system prune -a

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune
```

### Issue 7: Hot reload not working

**Solution:**
```powershell
# Ensure volumes are mounted correctly in docker-compose.local.yml:
volumes:
  - ./backend:/app
  - ./frontend:/app

# Restart with fresh build
docker-compose -f docker-compose.local.yml down
docker-compose -f docker-compose.local.yml up --build
```

---

## 🚀 Production Deployment

This Docker setup is for **local development only**.

For production deployment:
- Use Modal.com (serverless - recommended)
- Or VPS with `docker-compose.prod.yml`
- See: `MODAL-DEPLOYMENT.md` for production setup

---

## 📊 Performance Tips

### Speed Up Builds

```powershell
# Use BuildKit (faster builds)
$env:DOCKER_BUILDKIT=1
docker-compose -f docker-compose.local.yml build
```

### Reduce Image Size

```dockerfile
# Use multi-stage builds
FROM python:3.11-slim AS builder
# ... build steps

FROM python:3.11-slim AS runtime
COPY --from=builder /app /app
```

### Cache Dependencies

```powershell
# Don't rebuild if only code changed
# Dependencies are cached via layering
```

---

## 🎯 Development Workflow

### 1. Daily Development

```powershell
# Start (background)
docker-compose -f docker-compose.local.yml up -d

# Code your changes...
# Hot reload will pick up changes automatically

# View logs if needed
docker-compose -f docker-compose.local.yml logs -f backend

# Stop when done
docker-compose -f docker-compose.local.yml down
```

### 2. After Pulling New Code

```powershell
# Pull latest
git pull origin claude/ai-trader-shadow-mvp-setup-011CV55RbJpsFUXgSbmjzmbd

# Rebuild containers
docker-compose -f docker-compose.local.yml up --build
```

### 3. Testing New Features

```powershell
# Start fresh
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up --build

# Test in browser...

# Check logs for errors
docker-compose -f docker-compose.local.yml logs -f
```

---

## 🎓 What's Running?

When you run `docker-compose up`, these services start:

**Backend Container:**
- FastAPI server on port 8000
- Auto-reloads on code changes
- Connects to Supabase database
- Serves REST API + WebSocket

**Frontend Container:**
- Next.js dev server on port 3000
- Auto-reloads on code changes
- Proxies API calls to backend
- Hot Module Replacement (HMR)

---

## 🔗 Useful Links

**After starting:**
- Frontend: http://localhost:3000
- Backend API Docs: http://localhost:8000/docs
- Backend Health: http://localhost:8000/health
- Backend Admin: http://localhost:8000/admin (if enabled)

**Docker Dashboard:**
- Open Docker Desktop → Containers tab
- View logs, stats, and control containers

---

## 💡 Pro Tips

1. **Use Docker Desktop Dashboard** for easier container management
2. **Check "Automatically start Docker" in settings** for convenience
3. **Allocate more resources** to Docker (Settings → Resources)
4. **Use `.dockerignore`** to exclude unnecessary files (already configured)
5. **Keep Docker Desktop updated** for latest features

---

## ✅ Success Checklist

After running `docker-compose up`, verify:

- [ ] ✅ Both containers show "Up" in `docker ps`
- [ ] ✅ Backend health: http://localhost:8000/health returns `{"status":"healthy"}`
- [ ] ✅ Frontend loads at http://localhost:3000
- [ ] ✅ Dashboard displays with all components
- [ ] ✅ WebSocket shows "Connected" (green indicator)
- [ ] ✅ Strategy Selector shows PPO (GAIL locked 🔒)
- [ ] ✅ AI Recommendation displays action
- [ ] ✅ Trade Panel ready for testing
- [ ] ✅ No errors in `docker-compose logs`

---

## 🎉 You're All Set!

Your AI Trader's Shadow is now running in Docker!

**To recap:**
```powershell
# Start everything
docker-compose -f docker-compose.local.yml up -d

# Access application
# Frontend: http://localhost:3000
# Backend: http://localhost:8000

# Stop everything
docker-compose -f docker-compose.local.yml down
```

**That's it!** No Python, no Node.js, no complex setup. Just Docker! 🐳

---

**Need help?** Check the troubleshooting section or open an issue in the repository.

**Happy Trading!** 🚀
