# 🪟 AI Trader's Shadow - Windows Deployment Guide

**Panduan Lengkap Deployment untuk Windows 10/11**

---

## 📋 Prerequisites untuk Windows

### Step 1: Install Git untuk Windows

1. **Download Git:**
   - Buka: https://git-scm.com/download/win
   - Download installer (64-bit recommended)

2. **Install Git:**
   - Jalankan installer
   - **PENTING:** Pada opsi "Adjusting your PATH environment", pilih **"Git from the command line and also from 3rd-party software"**
   - Pada opsi "Choosing the SSH executable", pilih **"Use bundled OpenSSH"**
   - Semua opsi lain bisa default

3. **Verify Installation:**
   ```powershell
   # Buka PowerShell baru
   git --version
   # Output: git version 2.43.0 (atau versi lain)
   ```

---

### Step 2: Install Python

1. **Download Python:**
   - Buka: https://www.python.org/downloads/
   - Download Python 3.11 atau 3.12 (recommended)

2. **Install Python:**
   - Jalankan installer
   - **SANGAT PENTING:** ✅ Centang **"Add Python to PATH"** di bawah
   - Click **"Install Now"**

3. **Verify Installation:**
   ```powershell
   python --version
   # Output: Python 3.11.x atau 3.12.x

   pip --version
   # Output: pip 23.x.x
   ```

---

### Step 3: Install PostgreSQL Client (Optional)

**Opsi 1: Install PostgreSQL Full (Recommended)**

1. Download: https://www.postgresql.org/download/windows/
2. Download installer dari EDB
3. Install dengan semua defaults
4. Catat password yang Anda buat

**Opsi 2: Install hanya psql client via Chocolatey**

```powershell
# Install Chocolatey (package manager untuk Windows)
# Run PowerShell as Administrator
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install PostgreSQL client
choco install postgresql -y
```

**Verify:**
```powershell
psql --version
# Output: psql (PostgreSQL) 16.x
```

---

### Step 4: Install Node.js (untuk Frontend)

1. **Download Node.js:**
   - Buka: https://nodejs.org/
   - Download **LTS version** (Long Term Support)

2. **Install Node.js:**
   - Jalankan installer dengan semua defaults

3. **Verify Installation:**
   ```powershell
   node --version
   # Output: v20.x.x atau v18.x.x

   npm --version
   # Output: 10.x.x atau 9.x.x
   ```

---

## 🚀 DEPLOYMENT STEPS untuk Windows

### STEP 1: Clone Repository

1. **Buka PowerShell:**
   - Tekan `Win + X`, pilih **"Windows Terminal"** atau **"PowerShell"**

2. **Navigate ke folder projects:**
   ```powershell
   # Buat folder untuk projects (jika belum ada)
   mkdir D:\projects
   cd D:\projects

   # Clone repository
   git clone https://github.com/bagussundaru/claude-code.git

   # Masuk ke folder
   cd claude-code

   # Switch ke branch deployment
   git checkout claude/ai-trader-shadow-mvp-setup-011CV55RbJpsFUXgSbmjzmbd

   # Verify files ada
   dir
   ```

**Expected Output:**
```
Directory: D:\projects\claude-code

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----        1/13/2025   1:00 PM                ai-traders-shadow
-a----        1/13/2025   1:00 PM           7800 DEPLOY-NOW.sh
-a----        1/13/2025   1:00 PM          45000 DEPLOYMENT-READY.md
-a----        1/13/2025   1:00 PM           3200 PUSH-TO-GITHUB.sh
-a----        1/13/2025   1:00 PM          12000 QUICK-START.md
```

---

### STEP 2: Setup Database dengan PowerShell

**Karena script bash tidak bisa langsung jalan di PowerShell, kita akan setup database secara manual:**

```powershell
# Set database URL (ganti dengan credentials Anda)
$env:DATABASE_URL = "postgresql://postgres:Shadow19*@db.rjkcbdvnnzfqgxgwlabi.supabase.co:5432/postgres"

# Navigate ke folder database
cd D:\projects\claude-code\ai-traders-shadow

# Apply schema
psql $env:DATABASE_URL -f database/schema.sql

# Apply migration
psql $env:DATABASE_URL -f database/migrations/001_add_expert_demonstrations.sql

# Verify tables created
psql $env:DATABASE_URL -c "\dt"
```

**Expected Output:**
```
                    List of relations
 Schema |          Name              | Type  |  Owner
--------+----------------------------+-------+----------
 public | expert_demonstrations      | table | postgres
 public | trades_paper              | table | postgres
 public | users                      | table | postgres
```

---

### STEP 3: Install Modal CLI

```powershell
# Install Modal
pip install modal

# Verify installation
modal --version
# Output: modal client version: 1.2.x
```

---

### STEP 4: Authenticate Modal

```powershell
# Set Modal credentials
modal token set --token-id ak-Udk1F0hH12N3WuCiXOeevw --token-secret as-gJNmbNRC0pO6CCmG00Ze9E

# Verify authentication
modal profile list
```

**Expected Output:**
```
┏━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━┓
┃ ✓ ┃ Profile    ┃ Workspace         ┃
┡━━━╇━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━┩
│ ✓ │ default    │ bagussundaru      │
└───┴────────────┴───────────────────┘
```

---

### STEP 5: Configure Modal Secrets

```powershell
# Navigate to backend
cd D:\projects\claude-code\ai-traders-shadow\backend

# Generate secret key
$SECRET_KEY = -join ((65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Create Modal secret
modal secret create ai-traders-shadow-secrets `
  DATABASE_URL="postgresql://postgres:Shadow19*@db.rjkcbdvnnzfqgxgwlabi.supabase.co:5432/postgres" `
  SECRET_KEY=$SECRET_KEY `
  DB_PASSWORD="Shadow19*" `
  BINANCE_API_KEY="" `
  BINANCE_API_SECRET="" `
  TELEGRAM_BOT_TOKEN=""

# Verify secret created
modal secret list
```

**Expected Output:**
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Secret                      ┃
┡━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩
│ ai-traders-shadow-secrets   │
└─────────────────────────────┘
```

---

### STEP 6: Train PPO Model

```powershell
# Make sure you're in backend folder
cd D:\projects\claude-code\ai-traders-shadow\backend

# Train PPO model (this will take 5-10 minutes)
python -m app.ml.train_ppo

# Verify model created
dir models\
```

**Expected Output:**
```
Directory: D:\projects\claude-code\ai-traders-shadow\backend\models

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----        1/13/2025   2:30 PM        2400000 ppo_crypto_final.zip
```

---

### STEP 7: Deploy Backend to Modal

```powershell
# Make sure you're in backend folder
cd D:\projects\claude-code\ai-traders-shadow\backend

# Test deployment first (optional)
modal run app.modal_app

# Deploy to production
modal deploy app.modal_app
```

**Expected Output:**
```
✓ Created deployment
✓ App deployed! 🎉

View at: https://modal.com/apps/ap-XXXXXXXX

Endpoints:
  https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run
```

**🎯 SAVE THIS URL!** - Ini adalah backend API endpoint Anda

---

### STEP 8: Verify Backend Deployment

```powershell
# Test backend health (gunakan curl atau browser)
# Install curl for Windows jika belum ada:
# Download dari: https://curl.se/windows/

# Test health endpoint
curl https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run/health

# Expected: {"status":"healthy"}

# Test PPO model
curl https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run/api/v1/prediction/model/health?strategy=PPO

# Expected: {"status":"healthy","model_loaded":true}

# Get prediction
curl https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run/api/v1/prediction/predict/BTC-USDT?strategy=PPO
```

---

### STEP 9: Deploy Frontend to Vercel

```powershell
# Navigate to frontend folder
cd D:\projects\claude-code\ai-traders-shadow\frontend

# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel

# Follow prompts:
# ? Set up and deploy "D:\projects\claude-code\ai-traders-shadow\frontend"? Yes
# ? Which scope? Your account
# ? Link to existing project? No
# ? What's your project's name? ai-traders-shadow
# ? In which directory is your code located? ./
# ? Want to override the settings? No
```

**After deployment completes:**

1. **Buka Vercel Dashboard:**
   - Go to: https://vercel.com/dashboard
   - Select project: `ai-traders-shadow`

2. **Set Environment Variables:**
   - Click **Settings** → **Environment Variables**
   - Add these variables:
     ```
     NEXT_PUBLIC_API_URL = https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run
     NEXT_PUBLIC_WS_URL = wss://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run
     ```
   - Click **Save**

3. **Redeploy:**
   ```powershell
   vercel --prod
   ```

---

## ✅ VERIFICATION CHECKLIST

### 1. Backend Health Check
```powershell
# Open browser and go to:
https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run/health

# Should show:
{"status":"healthy"}
```

### 2. Frontend Check
```powershell
# Open browser and go to your Vercel URL:
https://ai-traders-shadow.vercel.app

# Verify:
# - Dashboard loads
# - WebSocket connects (green indicator)
# - Mood Meter shows data
# - AI Recommendation displays
# - Strategy Selector shows PPO (GAIL locked 🔒)
```

### 3. Database Check
```powershell
# Check expert_demonstrations table exists
psql $env:DATABASE_URL -c "SELECT COUNT(*) FROM expert_demonstrations;"

# Should return 0 (empty table, ready for data)
```

### 4. Execute Test Trade
1. Open frontend di browser
2. Wait for AI recommendation
3. Click **BUY** button (0.001 BTC)
4. Wait 10 seconds
5. Click **SELL** button
6. Check database:
   ```powershell
   psql $env:DATABASE_URL -c "SELECT * FROM expert_demonstrations ORDER BY created_at DESC LIMIT 1;"
   ```

---

## 🆘 TROUBLESHOOTING untuk Windows

### Issue 1: "psql: command not found"

**Solution:**
```powershell
# Add PostgreSQL to PATH manually
# 1. Find PostgreSQL installation path (biasanya):
# C:\Program Files\PostgreSQL\16\bin

# 2. Add to PATH:
# - Open Start Menu, search "Environment Variables"
# - Click "Edit the system environment variables"
# - Click "Environment Variables" button
# - Under "System variables", find "Path", click "Edit"
# - Click "New" and add: C:\Program Files\PostgreSQL\16\bin
# - Click OK, OK, OK

# 3. Restart PowerShell dan test
psql --version
```

### Issue 2: "python: command not found"

**Solution:**
```powershell
# Verify Python installed
Get-Command python

# If not found, reinstall Python and MAKE SURE to check "Add Python to PATH"
# Or add manually:
# Add this to PATH: C:\Users\YourUsername\AppData\Local\Programs\Python\Python311
```

### Issue 3: Modal connection failed

**Solution:**
```powershell
# Check internet connection
Test-NetConnection api.modal.com -Port 443

# Re-authenticate
modal token set --token-id ak-Udk1F0hH12N3WuCiXOeevw --token-secret as-gJNmbNRC0pO6CCmG00Ze9E
```

### Issue 4: Permission denied errors

**Solution:**
```powershell
# Run PowerShell as Administrator
# Right-click PowerShell icon → "Run as Administrator"
```

### Issue 5: Git checkout failed

**Solution:**
```powershell
# Fetch all branches first
git fetch --all

# Then checkout
git checkout claude/ai-trader-shadow-mvp-setup-011CV55RbJpsFUXgSbmjzmbd

# If still fails, verify branch exists
git branch -r
```

---

## 📝 Windows-Specific Notes

### Using Git Bash (Alternative)

Jika Anda lebih nyaman dengan bash commands:

1. **Install Git untuk Windows** (sudah include Git Bash)
2. **Buka Git Bash** (Right-click di folder → "Git Bash Here")
3. **Jalankan bash script:**
   ```bash
   cd /d/projects/claude-code
   chmod +x DEPLOY-NOW.sh
   ./DEPLOY-NOW.sh
   ```

### Using WSL (Windows Subsystem for Linux) - Advanced

Jika Anda ingin pengalaman Linux di Windows:

1. **Install WSL:**
   ```powershell
   # Run as Administrator
   wsl --install
   # Restart computer
   ```

2. **Install Ubuntu dari Microsoft Store**

3. **Open Ubuntu terminal dan follow Linux instructions**

---

## 🎯 Quick Reference - All Commands

```powershell
# 1. Clone repository
git clone https://github.com/bagussundaru/claude-code.git
cd claude-code
git checkout claude/ai-trader-shadow-mvp-setup-011CV55RbJpsFUXgSbmjzmbd

# 2. Setup database
$env:DATABASE_URL = "postgresql://postgres:Shadow19*@db.rjkcbdvnnzfqgxgwlabi.supabase.co:5432/postgres"
cd ai-traders-shadow
psql $env:DATABASE_URL -f database/schema.sql
psql $env:DATABASE_URL -f database/migrations/001_add_expert_demonstrations.sql

# 3. Install Modal & authenticate
pip install modal
modal token set --token-id ak-Udk1F0hH12N3WuCiXOeevw --token-secret as-gJNmbNRC0pO6CCmG00Ze9E

# 4. Configure secrets
cd backend
modal secret create ai-traders-shadow-secrets `
  DATABASE_URL="postgresql://postgres:Shadow19*@db.rjkcbdvnnzfqgxgwlabi.supabase.co:5432/postgres" `
  SECRET_KEY="$(openssl rand -hex 32)" `
  DB_PASSWORD="Shadow19*"

# 5. Train model
python -m app.ml.train_ppo

# 6. Deploy backend
modal deploy app.modal_app

# 7. Deploy frontend
cd ../frontend
npm install -g vercel
vercel
# Set env vars in Vercel dashboard
vercel --prod
```

---

## 🎉 SUCCESS!

Jika semua langkah berhasil, Anda akan memiliki:

✅ **Backend URL:** https://bagussundaru--ai-traders-shadow-backend-fastapi-app.modal.run
✅ **Frontend URL:** https://ai-traders-shadow.vercel.app
✅ **Database:** Supabase dengan tables ready
✅ **PPO Model:** Trained dan deployed
✅ **GAIL Ready:** UI locked, ready untuk premium tier

**Your Data Flywheel is LIVE!** 🌱→🌳

---

## 💡 Next Steps

1. **Week 1:** Collect 100+ expert demonstrations
2. **Week 2:** Analyze data quality
3. **Week 3:** Train GAIL model
4. **Week 4:** Launch premium tier

---

## 📚 Additional Resources

- **DEPLOYMENT-READY.md** - Complete deployment guide
- **E2E-TEST-PLAN.md** - Testing procedures
- **GAIL-IMPLEMENTATION.md** - GAIL training guide

---

**Happy Trading!** 🚀
