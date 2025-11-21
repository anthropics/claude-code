# 🚨 URGENT: WebSocket Configuration Fix

## Problem Identified
Frontend is connecting to `ws://localhost:8000` instead of the Modal backend WebSocket server.

**Error in browser console**:
```
WebSocket connection to 'ws://localhost:8000/ws/1' failed
GET http://localhost:8000/api/v1/trading/portfolio net::ERR_CONNECTION_REFUSED
```

## Root Cause
The environment variables `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` are not being picked up by Vercel during the build process.

## Solution (Choose One)

### Solution 1: Set Environment Variables in Vercel Dashboard (RECOMMENDED - 3 minutes)

**This is the proper way to do it:**

1. **Go to Vercel Dashboard**
   - https://vercel.com/dashboard
   - Click on the `frontend` project

2. **Navigate to Settings**
   - Settings tab (on the project page)
   - Then click: Environment Variables (in left sidebar)

3. **Add Environment Variable 1**
   ```
   Name: NEXT_PUBLIC_API_URL
   Value: https://bagussundaru--ai-traders-shadow-backend-web.modal.run
   Environment: Production ✓ (check this)
   Click: Save
   ```

4. **Add Environment Variable 2**
   ```
   Name: NEXT_PUBLIC_WS_URL
   Value: wss://bagussundaru--ai-traders-shadow-backend-web.modal.run
   Environment: Production ✓ (check this)
   Click: Save
   ```

5. **Redeploy Frontend**
   - Go to: Deployments tab
   - Find: Latest deployment (should show your latest code)
   - Click: ••• (three dots) on the right
   - Select: Redeploy
   - Wait: 1-2 minutes for build to complete

6. **Verify**
   - Open: https://frontend-ovt70ebe7-bagus-sundarus-projects.vercel.app
   - Press: F12 (Developer Tools)
   - Go to: Console tab
   - Should see: `[WebSocket] Connecting to wss://bagussundaru--ai-traders-shadow-backend-web.modal.run/ws/1...`
   - Should NOT see: `ws://localhost:8000`
   - After ~2 seconds: `[WebSocket] Connected successfully`

---

### Solution 2: Use Vercel CLI (Alternative)

If you prefer command line:

```bash
cd ai-traders-shadow/frontend

# Pull current env vars (to see what's there)
vercel env pull

# Add the env vars (interactive)
vercel env add NEXT_PUBLIC_API_URL production
# Paste: https://bagussundaru--ai-traders-shadow-backend-web.modal.run

vercel env add NEXT_PUBLIC_WS_URL production
# Paste: wss://bagussundaru--ai-traders-shadow-backend-web.modal.run

# Redeploy
vercel --prod --yes
```

---

### Solution 3: Direct Environment Variables (Manual)

If Vercel dashboard is not accessible:

1. Create/edit Vercel project settings file
2. Or contact Vercel support with your environment variables

---

## Why This Happened

✗ **What didn't work**:
- `.env.production` file in the repository (Vercel ignores this for security reasons)
- Environment variables not set in Vercel project settings
- Frontend built without the `NEXT_PUBLIC_` variables

✓ **What will work**:
- Setting environment variables in Vercel project settings (Settings → Environment Variables)
- Redeploying frontend after setting env vars
- The frontend will then be built with these values embedded

---

## Verification Checklist (After Fix)

- [ ] Visit Vercel dashboard
- [ ] Check Settings → Environment Variables
- [ ] Confirm both `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` are set
- [ ] Environment is set to "Production"
- [ ] Go to Deployments and click Redeploy
- [ ] Wait for build to complete (green checkmark)
- [ ] Open frontend URL in browser
- [ ] F12 → Console → Should see wss:// WebSocket URL (not ws://localhost:8000)
- [ ] Wait for: `[WebSocket] Connected successfully`

---

## Important Notes

1. **NEXT_PUBLIC_ prefix is required** - These variables are embedded in the frontend at build time
2. **Must be in Production environment** - Select "Production" when adding variables
3. **Redeploy is required** - Just setting the variables isn't enough; frontend must be rebuilt
4. **Check the environment** - Vercel has different environments (Development, Preview, Production)

---

## What the Variables Do

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_API_URL` | `https://bagussundaru--ai-traders-shadow-backend-web.modal.run` | REST API endpoint for portfolio data |
| `NEXT_PUBLIC_WS_URL` | `wss://bagussundaru--ai-traders-shadow-backend-web.modal.run` | WebSocket endpoint for real-time data |

Both are required for the frontend to connect to the backend.

---

## Expected Result After Fix

**Before**:
```
[WebSocket] Connecting to ws://localhost:8000/ws/1...
WebSocket connection to 'ws://localhost:8000/ws/1' failed
GET http://localhost:8000/api/v1/trading/portfolio net::ERR_CONNECTION_REFUSED
[WebSocket] Error: Event
[WebSocket] Connection closed
[WebSocket] Reconnecting in 4000ms (attempt 2/10)...
```

**After**:
```
[WebSocket] Connecting to wss://bagussundaru--ai-traders-shadow-backend-web.modal.run/ws/1...
[WebSocket] Connected successfully
Portfolio data loaded successfully
Real-time mood meter updating
[WebSocket] Message received: mood
```

---

## Need More Help?

1. **Screenshots wanted**: The steps above should be enough, but you can search YouTube for "Vercel environment variables" for a video walkthrough
2. **Still not working**: Check:
   - Environment variable names (case-sensitive)
   - Value format (full HTTPS/WSS URLs)
   - Environment set to "Production" 
   - Redeploy actually completed (check deployment status)
3. **Backend offline**: Make sure Modal backend is still running:
   ```bash
   curl https://bagussundaru--ai-traders-shadow-backend-web.modal.run/health
   ```
   Should return: `{"status":"healthy",...}`

---

## TL;DR (Quick Fix)

1. Vercel Dashboard → frontend project
2. Settings → Environment Variables
3. Add: `NEXT_PUBLIC_API_URL` = `https://bagussundaru--ai-traders-shadow-backend-web.modal.run`
4. Add: `NEXT_PUBLIC_WS_URL` = `wss://bagussundaru--ai-traders-shadow-backend-web.modal.run`
5. Deployments → Redeploy
6. Done! WebSocket will work.

**Time required**: 3 minutes
