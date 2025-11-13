# 🎯 QUICK FIX: WebSocket Not Working

## ❌ Problem
Frontend showing:
```
WebSocket connection to 'ws://localhost:8000/ws/1' failed
GET http://localhost:8000/api/v1/trading/portfolio net::ERR_CONNECTION_REFUSED
```

## ✅ Solution (3 Steps - 3 Minutes)

### Step 1: Open Vercel Dashboard
```
https://vercel.com/dashboard
```

### Step 2: Set Environment Variables

**Click**: Select `frontend` project  
**Click**: Settings (tab at top)  
**Click**: Environment Variables (left sidebar)  

**Then add these 2 variables:**

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://bagussundaru--ai-traders-shadow-backend-web.modal.run` | ✓ Production |
| `NEXT_PUBLIC_WS_URL` | `wss://bagussundaru--ai-traders-shadow-backend-web.modal.run` | ✓ Production |

**For each one**:
1. Type the Name
2. Paste the Value
3. Make sure "Production" is selected
4. Click Save

### Step 3: Redeploy

**Click**: Deployments (tab at top)  
**Click**: ••• (three dots) on latest deployment  
**Click**: Redeploy  
**Wait**: 1-2 minutes for build  

## ✨ Verify It Works

Open frontend in browser:  
https://frontend-ovt70ebe7-bagus-sundarus-projects.vercel.app

Press `F12` → Console tab

**Should show**:
```
[WebSocket] Connecting to wss://bagussundaru--ai-traders-shadow-backend-web.modal.run/ws/1...
[WebSocket] Connected successfully ✓
```

**Should NOT show**:
```
ws://localhost:8000  ❌
Connection refused ❌
```

---

## 📝 Copy-Paste Values

Just in case you need them:

**NEXT_PUBLIC_API_URL:**
```
https://bagussundaru--ai-traders-shadow-backend-web.modal.run
```

**NEXT_PUBLIC_WS_URL:**
```
wss://bagussundaru--ai-traders-shadow-backend-web.modal.run
```

---

## ⏱️ Time Required
- Setting vars: ~1 minute
- Redeploy: ~1-2 minutes
- Verify: ~1 minute
- **Total: 3 minutes**

---

## 🆘 Still Not Working?

**If still showing localhost:**
1. Hard refresh: `Ctrl+Shift+R`
2. Clear cache: `Ctrl+Shift+Delete` → Check "Cached images and files"
3. Check Vercel deployment status (should be green ✓)
4. Wait 2-3 more minutes (CDN propagation)

**If Redeploy button doesn't appear:**
- Make sure you selected "Production" environment for variables
- Try Deployments → Latest → More options (⋮) → Redeploy

**If still failing after 5 minutes:**
- Backend might be offline: `curl https://bagussundaru--ai-traders-shadow-backend-web.modal.run/health`
- Should return: `{"status":"healthy"...}`

---

## 🎉 After Fix Works
- Real-time market data
- Live mood meter
- Portfolio updates
- Trading signals
- WebSocket streaming

**Everything starts working!** ✨
