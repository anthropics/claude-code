# 🚀 CCTTB Bot - Quick Fix Reference

**Date:** Nov 20, 2025
**Status:** ✅ All fixes applied

---

## ⚡ Quick Start (5 Minutes)

### Step 1: Run Setup Script
```powershell
cd C:\path\to\CCTTB_freshnew
.\SETUP_WINDOWS.ps1
```

### Step 2: Place Credentials
Put your `ccttb-bot-key.json` file here:
```
C:\Users\{YourUsername}\Documents\cAlgo\ServiceAccount\credentials.json
```

### Step 3: Build & Run
```powershell
dotnet build --configuration Release
```
Then load in cTrader.

---

## 🔍 Quick Checks

### ✅ Bot Working Correctly:
```
[Gemini] ✅ Found credentials at: ...
[GEMINI API] BlockNewEntries=False, RiskMult=1.00
```

### ❌ Credentials Missing:
```
[Gemini] ❌ ERROR: Service account credentials not found!
```
**Fix:** Place credentials.json in any searched location (see error log)

### ⏱️ Rate Limited (Normal):
```
[Gemini] Rate limit: Skipping call (next call in X minutes)
```
**Fix:** Not a problem - this is normal behavior

### 🛑 Circuit Breaker (After 3 Failures):
```
[Gemini] Circuit breaker: Too many failures (3)
```
**Fix:** Restart bot or fix API authentication

---

## 📂 Credential Locations (Priority Order)

1. **Environment variable** (set once, works forever):
   ```powershell
   $env:CCTTB_SERVICE_ACCOUNT_PATH = "C:\path\to\credentials.json"
   ```

2. **User profile** (recommended):
   ```
   C:\Users\{YourUsername}\Documents\cAlgo\ServiceAccount\credentials.json
   ```

3. **Shared location**:
   ```
   C:\cAlgo\ServiceAccount\credentials.json
   ```

4. **Bot directory**:
   ```
   {BotInstallDirectory}\credentials.json
   ```

---

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| "Credentials not found" | Check log for paths, place file in any location |
| "401 Unauthorized" | Recreate service account key in Google Cloud |
| "Trading blocked" | Check `BlockNewEntries=False` in logs |
| "API failing" | Bot will trade anyway with default risk params |

---

## 📊 Key Features

- ✅ **5 credential locations** (auto-discovery)
- ✅ **Rate limiting** (15 min minimum between calls)
- ✅ **Circuit breaker** (stops after 3 failures)
- ✅ **Fail-safe trading** (trades even when API fails)
- ✅ **Cross-user compatible** (works for any Windows user)

---

## 📖 Full Documentation

See: `ALL_FIXES_SUMMARY_NOV20.md`

---

**Ready to trade!** 🎯
