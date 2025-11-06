# Gemini API Authentication Setup Guide

## ✅ What Was Fixed

The bot was failing to authenticate with Google Cloud Workflows API because it wasn't sending OAuth credentials.

**Changes made to `Utils_SmartNewsAnalyzer.cs`:**
- ✅ Added Google.Apis.Auth.OAuth2 library import
- ✅ Added `GetAccessTokenAsync()` method to obtain OAuth tokens
- ✅ Added `Authorization: Bearer <token>` header to API requests
- ✅ Added service account file path configuration

---

## 🔐 Security Setup Instructions

### Step 1: Revoke the Old Key (CRITICAL!)

**You accidentally shared your private key publicly. You MUST revoke it immediately!**

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=my-trader-bot-api
2. Find the service account: `ccttb-bot-invoker@my-trader-bot-api.iam.gserviceaccount.com`
3. Click on it → Go to "Keys" tab
4. Find the key with ID: `5f37fc500184bf3cdee530516b8161e07d287f79`
5. Click the three dots (⋮) → Delete
6. Confirm deletion

### Step 2: Create a New Service Account Key

1. In the same service account page
2. Click **"Add Key"** → **"Create new key"**
3. Select **"JSON"**
4. Click **"Create"**
5. Save the downloaded JSON file securely

---

## 📁 Step 3: Install the Credentials File

**On your Windows trading machine:**

1. Create a secure directory:
   ```
   C:\Users\Administrator\Documents\cAlgo\ServiceAccount\
   ```

2. Copy your **NEW** service account JSON file to:
   ```
   C:\Users\Administrator\Documents\cAlgo\ServiceAccount\credentials.json
   ```

3. **IMPORTANT**: Do NOT commit this file to git!

---

## 🔧 Step 4: Verify Permissions

Your service account needs permission to invoke the Workflow:

1. Go to: https://console.cloud.google.com/workflows/workflow/europe-west2/smart-news-api?project=my-trader-bot-api
2. Click **"Permissions"** tab
3. Ensure `ccttb-bot-invoker@my-trader-bot-api.iam.gserviceaccount.com` has role:
   - **"Workflows Invoker"** role

If not, add it:
1. Click **"Grant Access"**
2. Enter the service account email
3. Select Role: **"Workflows Invoker"**
4. Save

---

## 🏗️ Step 5: Rebuild the Bot

**In cTrader:**

1. Open cTrader Automate
2. Right-click on **CCTTB_freshnew** bot
3. Click **"Rebuild"** (not just Build - use Rebuild to force recompilation)
4. Wait for compilation to complete
5. Check for any errors

**OR in PowerShell:**

```powershell
cd C:\Users\Administrator\claude-code\robots\CCTTB_freshnew

# Pull latest changes
git pull origin claude/ccttb-freshnew-robot-011CUrkxpdrsh1wpHYQMH58o

# Build
dotnet build --configuration Release
```

---

## ✅ Step 6: Test the Fix

1. Restart your bot in cTrader
2. Watch the logs for:
   ```
   [Gemini] Analysis Received: <news context>
   ```

3. **If successful**, you'll see news analysis instead of:
   ```
   [Gemini] ⚠️ API call failed: Unauthorized
   ```

---

## 🔍 Troubleshooting

### Error: "Service account file not found"
**Solution:** Check that the file exists at:
```
C:\Users\Administrator\Documents\cAlgo\ServiceAccount\credentials.json
```

### Error: "Failed to get access token"
**Solutions:**
- Verify the JSON file is valid (not corrupted)
- Check that it's the NEW key (not the old revoked one)
- Ensure the file has proper JSON format

### Error: "403 Permission Denied"
**Solution:**
- Verify the service account has "Workflows Invoker" role
- Check the workflow is in the correct region (europe-west2)
- Ensure the workflow is enabled

### Still getting "401 Unauthorized"
**Solution:**
- Double-check you created a NEW service account key
- Make sure you deleted the OLD key
- Verify the credentials.json path is correct
- Try rebuilding the bot completely

---

## 📊 What the Fix Does

**Before:**
```
POST https://workflowexecutions.googleapis.com/...
Headers: Accept: application/json
Result: 401 Unauthorized ❌
```

**After:**
```
POST https://workflowexecutions.googleapis.com/...
Headers:
  Accept: application/json
  Authorization: Bearer ya29.c.c0ASRK0G... ✅
Result: 200 OK ✅
```

---

## 📝 Alternative: Disable Gemini API (Not Recommended)

If you want to disable Gemini API temporarily while testing:

**Option A:** The bot already has fail-safe mode enabled. It will continue trading with default risk parameters if API fails.

**Option B:** Comment out the API calls in `JadecapStrategy.cs` (search for `GetGeminiAnalysis`)

---

## 🎯 Summary

✅ Code has been fixed to include OAuth authentication
✅ Service account credentials are loaded from a secure file
✅ Authorization headers are now sent with every API request
⚠️ You MUST revoke the old key and create a new one
⚠️ You MUST place the new credentials.json in the correct location

**After completing all steps, your Gemini API integration should work!**
