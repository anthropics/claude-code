# 🔌 WEBSOCKET CONNECTION FIX - CONFIGURE BACKEND URL

**Issue:** Frontend showing "WebSocket Disconnected - ws://localhost:8000"  
**Reason:** Environment variables not configured in Vercel  
**Solution:** Set API URL environment variables

---

## ⚡ QUICK FIX (3 Steps)

### Step 1: Get Backend URL from Modal

```powershell
# Start the backend
cd D:\claude\claude-code\ai-traders-shadow\backend
python -m modal deploy -m modal_simple

# Wait for deployment, then get URL from output
# It should show something like:
# https://bagussundaru--ai-traders-shadow-backend-web.modal.run
```

The backend URL will be shown in the deployment output. **Copy this URL.**

### Step 2: Set Environment Variables in Vercel

Go to: **https://vercel.com/bagus-sundarus-projects/frontend**

**Steps:**
1. Click on the project
2. Go to **Settings** → **Environment Variables**
3. Add these two variables:

| Variable Name | Value | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Your Modal backend URL | `https://bagussundaru--ai-traders-shadow-backend-web.modal.run` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (same but with wss://) | `wss://bagussundaru--ai-traders-shadow-backend-web.modal.run` |

**How to add:**
- Click "Add New..."
- **Name:** `NEXT_PUBLIC_API_URL`
- **Value:** `https://bagussundaru--ai-traders-shadow-backend-web.modal.run` (replace with your URL)
- Click "Save"
- Repeat for `NEXT_PUBLIC_WS_URL` with `wss://` instead of `https://`

### Step 3: Redeploy Frontend

```powershell
cd D:\claude\claude-code\ai-traders-shadow\frontend
vercel --prod
```

Or click **"Redeploy"** in Vercel dashboard.

---

## 📋 FINDING YOUR MODAL BACKEND URL

### Method 1: From Deployment Output (Best)
When you run `python -m modal deploy -m modal_simple`, the output shows:
```
✅  Production: https://bagussundaru--ai-traders-shadow-backend-web.modal.run [3s]
```
Copy this URL.

### Method 2: From Modal Dashboard
1. Go to https://modal.com/account
2. Find your workspace (bagussundaru)
3. Click on "ai-traders-shadow-backend" app
4. Copy the endpoint URL

### Method 3: From Modal CLI
```powershell
python -m modal app describe ap-c6gY3y8cxqFXtripXAxeUg
# Look for "Endpoints" section
```

---

## 🔑 EXAMPLE VALUES

**If your Modal backend URL is:**
```
https://bagussundaru--ai-traders-shadow-backend-web.modal.run
```

**Then set these in Vercel:**
```
NEXT_PUBLIC_API_URL=https://bagussundaru--ai-traders-shadow-backend-web.modal.run
NEXT_PUBLIC_WS_URL=wss://bagussundaru--ai-traders-shadow-backend-web.modal.run
```

---

## ✅ VERIFICATION

After setting environment variables and redeploying:

1. **Visit Frontend:**
   ```
   https://frontend-2b7hz44tq-bagus-sundarus-projects.vercel.app
   ```

2. **Check Browser Console:**
   ```
   Open DevTools (F12) → Console
   Should show: "[WebSocket] Connecting to wss://bagussundaru--ai-traders-shadow-backend-web.modal.run/ws/1..."
   ```

3. **Check Network Tab:**
   ```
   Should show WebSocket connection to the backend URL (green)
   ```

4. **Check WebSocket Status:**
   ```
   The "WebSocket Disconnected" message should disappear
   Real-time updates should work
   ```

---

## 🚀 DEPLOYING BACKEND FOR FIRST TIME

If backend isn't running yet:

```powershell
# Navigate to backend
cd D:\claude\claude-code\ai-traders-shadow\backend

# Deploy to Modal
python -m modal deploy -m modal_simple

# This will:
# 1. Build Docker image
# 2. Upload to Modal
# 3. Start the app
# 4. Return endpoint URL

# Output will include:
# ✅  Production: https://bagussundaru--ai-traders-shadow-backend-web.modal.run
```

**Copy that URL and use it for the environment variables!**

---

## 🔍 TROUBLESHOOTING

### WebSocket still not connecting?

1. **Verify backend is running:**
   ```powershell
   python -m modal app list
   # Should show ai-traders-shadow-backend as "running"
   ```

2. **Check environment variables in Vercel:**
   - Go to Vercel → Project → Settings → Environment Variables
   - Make sure both `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` are set
   - Both should use your Modal backend URL

3. **Check browser console:**
   ```
   DevTools → Console → Look for WebSocket error messages
   ```

4. **Redeploy everything:**
   ```powershell
   # Redeploy backend
   cd D:\claude\claude-code\ai-traders-shadow\backend
   python -m modal deploy -m modal_simple
   
   # Wait for output, copy URL, update Vercel env vars
   # Then redeploy frontend
   cd D:\claude\claude-code\ai-traders-shadow\frontend
   vercel --prod
   ```

### Backend shows "stopped" in `python -m modal app list`?

1. **The app was idle and stopped** - This is normal for Modal
2. **Redeploy:**
   ```powershell
   cd D:\claude\claude-code\ai-traders-shadow\backend
   python -m modal deploy -m modal_simple
   ```

3. **For persistent backend, add to Modal Secrets:**
   - Keep app warm for longer: increase `container_idle_timeout`
   - Or monitor/keep alive with scheduled pings

---

## 💡 KEY POINTS

- ✅ **NEXT_PUBLIC_API_URL** - Used for REST API calls
- ✅ **NEXT_PUBLIC_WS_URL** - Used for WebSocket connections
- ✅ Both should point to same Modal backend URL
- ✅ Use `https://` for REST, `wss://` for WebSocket
- ✅ Environment variables are visible in browser (NEXT_PUBLIC_ prefix)
- ✅ After changing env vars in Vercel, must redeploy

---

## 📝 COMPLETE CHECKLIST

- [ ] Backend deployed to Modal
- [ ] Backend URL copied (e.g., `https://bagussundaru--...`)
- [ ] Login to Vercel: https://vercel.com/bagus-sundarus-projects/frontend
- [ ] Added `NEXT_PUBLIC_API_URL` environment variable
- [ ] Added `NEXT_PUBLIC_WS_URL` environment variable
- [ ] Frontend redeployed with `vercel --prod`
- [ ] Visited frontend URL
- [ ] Opened DevTools Console (F12)
- [ ] Verified WebSocket connecting message shows correct URL
- [ ] WebSocket connection successful (green indicator)

---

## 🎯 AFTER FIX

Once environment variables are set correctly:

1. **Frontend will connect to your Modal backend** ✅
2. **Real-time updates will work** ✅
3. **WebSocket errors will disappear** ✅
4. **Dashboard will show live data** ✅

---

**Need Help?** Check the browser console (F12) for error messages - they will guide you!
