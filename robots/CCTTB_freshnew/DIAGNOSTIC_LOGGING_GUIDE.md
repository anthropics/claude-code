# Diagnostic Logging Guide

**Purpose:** Enhanced diagnostic logging has been added to help troubleshoot credential loading issues.

---

## What's Been Added

### Enhanced Credential Loading Diagnostics (Lines 132-176)

The bot now prints detailed diagnostic information when starting up:

```csharp
// Checks environment variable
[GEMINI AUTH DEBUG] Environment variable GOOGLE_APPLICATION_CREDENTIALS: {value}

// Checks hardcoded path
[GEMINI AUTH DEBUG] Hardcoded credential path: C:\ccttb-credentials\ccttb-bot-key.json

// Checks if file exists
[GEMINI AUTH DEBUG] File.Exists check result: True/False
```

---

## Expected Log Messages

### ✅ Success Case (File Found):
```
[GEMINI AUTH DEBUG] Environment variable GOOGLE_APPLICATION_CREDENTIALS: C:\ccttb-credentials\ccttb-bot-key.json
[GEMINI AUTH DEBUG] Hardcoded credential path: C:\ccttb-credentials\ccttb-bot-key.json
[GEMINI AUTH DEBUG] File.Exists check result: True
[GEMINI AUTH] Loading credentials from: C:\ccttb-credentials\ccttb-bot-key.json
[GEMINI AUTH] ✅ Service account credentials loaded successfully
[GEMINI AUTH] Scoped to: https://www.googleapis.com/auth/cloud-platform
```

### ⚠️ Warning Case (File Not Found):
```
[GEMINI AUTH DEBUG] Environment variable GOOGLE_APPLICATION_CREDENTIALS: NOT SET
[GEMINI AUTH DEBUG] Hardcoded credential path: C:\ccttb-credentials\ccttb-bot-key.json
[GEMINI AUTH DEBUG] File.Exists check result: False
[GEMINI AUTH] ⚠️ WARNING: Credential file not found at C:\ccttb-credentials\ccttb-bot-key.json
[GEMINI AUTH DEBUG] Parent directory: C:\ccttb-credentials
[GEMINI AUTH DEBUG] Directory exists: True/False
[GEMINI AUTH DEBUG] Files in directory: 0
[GEMINI AUTH] ❌ API calls will fail without authentication
```

### ❌ Error Case (Exception):
```
[GEMINI AUTH DEBUG] Environment variable GOOGLE_APPLICATION_CREDENTIALS: ...
[GEMINI AUTH DEBUG] Hardcoded credential path: ...
[GEMINI AUTH DEBUG] File.Exists check result: ...
[GEMINI AUTH] ❌ ERROR loading credentials: [error message]
[GEMINI AUTH] Stack trace: [stack trace]
```

---

## How to Use This Logging

### Step 1: Run the Bot
Load the bot in cTrader and start it (backtest or live).

### Step 2: Check the Log Tab
Go to the "Log" tab in cTrader Automate.

### Step 3: Look for Diagnostic Messages
Search for messages starting with `[GEMINI AUTH]`.

---

## Troubleshooting Guide

### Issue 1: Environment Variable Not Set
**Symptom:**
```
[GEMINI AUTH DEBUG] Environment variable GOOGLE_APPLICATION_CREDENTIALS: NOT SET
```

**Solution:**
This is normal if you're using the hardcoded path. The bot will use the hardcoded path instead.

---

### Issue 2: File Not Found
**Symptom:**
```
[GEMINI AUTH DEBUG] File.Exists check result: False
[GEMINI AUTH] ⚠️ WARNING: Credential file not found
```

**Solution:**
1. Check if file exists:
   ```bash
   dir "C:\ccttb-credentials\ccttb-bot-key.json"
   ```

2. If file doesn't exist, download it from Google Cloud Console:
   - Go to IAM & Service Accounts
   - Find `ccttb-bot-invoker@my-trader-bot-api.iam.gserviceaccount.com`
   - Create/download key
   - Save to `C:\ccttb-credentials\ccttb-bot-key.json`

3. Verify file permissions:
   ```bash
   icacls "C:\ccttb-credentials\ccttb-bot-key.json"
   ```

---

### Issue 3: Directory Not Found
**Symptom:**
```
[GEMINI AUTH DEBUG] Directory exists: False
```

**Solution:**
1. Create the directory:
   ```bash
   mkdir "C:\ccttb-credentials"
   ```

2. Copy the key file to the directory

3. Restart the bot

---

### Issue 4: Permission Denied
**Symptom:**
```
[GEMINI AUTH] ❌ ERROR loading credentials: Access to the path ... is denied
```

**Solution:**
1. Run cTrader as Administrator
2. Or change file permissions:
   ```bash
   icacls "C:\ccttb-credentials\ccttb-bot-key.json" /grant Users:R
   ```

---

### Issue 5: Invalid JSON
**Symptom:**
```
[GEMINI AUTH] ❌ ERROR loading credentials: Invalid JSON...
```

**Solution:**
1. Re-download the service account key from Google Cloud Console
2. Ensure file is not corrupted
3. Verify it's a valid JSON file:
   ```bash
   powershell -Command "Get-Content 'C:\ccttb-credentials\ccttb-bot-key.json' | ConvertFrom-Json"
   ```

---

## Additional Diagnostics

### If Directory Exists but File Missing:
The bot will list up to 5 files in the directory to help identify the issue:

```
[GEMINI AUTH DEBUG] Files in directory: 3
[GEMINI AUTH DEBUG]   - some-other-file.json
[GEMINI AUTH DEBUG]   - credentials.json
[GEMINI AUTH DEBUG]   - service-account.json
```

This helps identify if:
- The file has a different name
- The file is in a different location
- The directory is empty

---

## Disabling Diagnostic Logging (Optional)

If you want to reduce log verbosity after successful setup:

1. Keep the success/error messages (✅ ⚠️ ❌)
2. Remove the `[GEMINI AUTH DEBUG]` lines

To do this, comment out lines 136-139 in `Utils_SmartNewsAnalyzer.cs`:
```csharp
// _robot.Print($"[GEMINI AUTH DEBUG] Environment variable...");
// _robot.Print($"[GEMINI AUTH DEBUG] Hardcoded credential path...");
// _robot.Print($"[GEMINI AUTH DEBUG] File.Exists check result...");
```

---

## Verification Checklist

After bot startup, verify:

- [ ] `[GEMINI AUTH DEBUG]` messages appear in log
- [ ] Environment variable status is shown
- [ ] File.Exists result is shown
- [ ] If file found: ✅ Success message appears
- [ ] If file missing: ⚠️ Warning message appears
- [ ] No ❌ error messages (unless file truly missing)

---

## Integration with JadecapStrategy.cs

Once you add the 5 code blocks to JadecapStrategy.cs, you'll also see:

```
[GEMINI API] Background news analysis timer started (15-minute interval)
```

And every 15 minutes:
```
[Gemini] Successfully obtained access token
[Gemini] Analysis Received: ...
[GEMINI API] News analysis updated: ...
```

---

## File Location

This diagnostic logging is in:
- **File:** `Utils_SmartNewsAnalyzer.cs`
- **Lines:** 132-176
- **Method:** Constructor (`SmartNewsAnalyzer()`)

---

## Build Status

```
✅ Build succeeded
   0 Errors
   1 Warning (deprecation, non-critical)
   Time: 7.40 seconds
```

---

**Status:** Diagnostic logging active and ready for testing
**Next Step:** Add 5 code blocks to JadecapStrategy.cs
**Documentation:** See [INTEGRATION_CODE_BLOCKS.txt](INTEGRATION_CODE_BLOCKS.txt:1)

Generated: 2025-11-02
