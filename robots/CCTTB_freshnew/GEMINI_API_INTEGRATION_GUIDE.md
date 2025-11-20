# Gemini API Integration Guide

## Summary

This guide documents the integration of the Google Cloud Workflow Gemini AI API into the CCTTB trading bot. The integration is now **COMPLETE** for `Utils_SmartNewsAnalyzer.cs`.

## Part 1: Utils_SmartNewsAnalyzer.cs - COMPLETED ✅

The following changes have been successfully applied to `Utils_SmartNewsAnalyzer.cs`:

### 1. Added Using Statements
```csharp
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
```

### 2. Added GeminiApiRequest Class
```csharp
public class GeminiApiRequest
{
    public string asset { get; set; }
    public string utc_time { get; set; }
    public string current_bias { get; set; }
    public int lookahead_minutes { get; set; }
}
```

### 3. Added HTTP Client Fields
```csharp
private static readonly HttpClient _httpClient = new HttpClient();
private string _workflowApiUrl = "https://workflowexecutions.googleapis.com/v1/projects/my-trader-bot-api/locations/europe-west2/workflows/smart-news-api/executions";
```

### 4. Added GetGeminiAnalysis Method
This method calls the API and returns `NewsContextAnalysis` or a fail-safe response.

### 5. Added GetFailSafeContext Method
Returns a safe blocking response if the API fails.

---

## Part 2: JadecapStrategy.cs - NEEDS MANUAL INTEGRATION

You need to manually add the following code blocks to `JadecapStrategy.cs`:

### Change 1: Add New Fields (around line 692)

**Location:** Find the section with `private NewsContextAnalysis _currentNewsContext;`

**Add these two lines AFTER line 692:**
```csharp
private System.Threading.Timer _analysisTimer; // NEW: Timer for API calls
private object _analysisLock = new object(); // NEW: For thread safety
```

**Result should look like:**
```csharp
private NewsAwareness _newsAwareness;  // Legacy simple news detection
private SmartNewsAnalyzer _smartNews; // NEW: Smart contextual news analysis
private NewsContextAnalysis _currentNewsContext;
private System.Threading.Timer _analysisTimer; // NEW: Timer for API calls
private object _analysisLock = new object(); // NEW: For thread safety
```

---

### Change 2: Modify OnStart() Method (around line 1495)

**Location:** Find the line `_smartNews = new SmartNewsAnalyzer(...)`  (around line 1495)

**Add this code block AFTER the SmartNewsAnalyzer initialization:**
```csharp
// ═══════════════════════════════════════════════════════════════════
// NEW: Initialize Gemini API Integration
// ═══════════════════════════════════════════════════════════════════

// Initialize the news context as "Normal" until the first API call
_currentNewsContext = new NewsContextAnalysis
{
    Context = NewsContext.Normal,
    Reaction = VolatilityReaction.Normal,
    ConfidenceAdjustment = 0.0,
    RiskMultiplier = 1.0,
    BlockNewEntries = false,
    InvalidateBias = false,
    Reasoning = "Initializing..."
};

// Start the background timer to update news analysis every 15 minutes
// It will wait 10 seconds before the first call, then run every 15 mins
_analysisTimer = new System.Threading.Timer(
    async _ => await UpdateNewsAnalysis(),
    null,
    TimeSpan.FromSeconds(10),       // Wait 10s for first run
    TimeSpan.FromMinutes(15)      // Run every 15 minutes
);

Print("[GEMINI API] Background news analysis timer started (15-minute interval)");
```

---

### Change 3: Add UpdateNewsAnalysis() Method

**Location:** Add this new method anywhere in the JadecapStrategy class (good place: after OnStart() method, around line 1700)

```csharp
/// <summary>
/// This method is called by a background timer to update the news analysis via Gemini API.
/// </summary>
private async Task UpdateNewsAnalysis()
{
    try
    {
        // Get the bot's current state
        string asset = Symbol.Name;
        DateTime utcTime = Server.TimeInUtc;
        BiasDirection bias = _currentBias; // Current bias direction
        int lookahead = 240; // Look ahead 4 hours

        // Call the Gemini API
        NewsContextAnalysis newAnalysis = await _smartNews.GetGeminiAnalysis(
            asset,
            utcTime,
            bias,
            lookahead
        );

        // Safely update the shared variable
        lock (_analysisLock)
        {
            _currentNewsContext = newAnalysis;
        }

        if (_config.EnableDebugLogging)
        {
            Print($"[GEMINI API] News analysis updated: {newAnalysis.Reasoning}");
            Print($"[GEMINI API] BlockNewEntries={newAnalysis.BlockNewEntries}, RiskMult={newAnalysis.RiskMultiplier:F2}, ConfAdj={newAnalysis.ConfidenceAdjustment:F2}");
        }
    }
    catch (Exception ex)
    {
        Print($"[GEMINI API] CRITICAL TIMER ERROR: {ex.Message}");
    }
}
```

---

### Change 4: Add News Blocking Check to BuildTradeSignal()

**Location:** Find the `BuildTradeSignal()` method (around line 3575)

**Add this code block EARLY in the method, before any other entry gates:**

```csharp
// ═══════════════════════════════════════════════════════════════════
// GEMINI API NEWS FILTER: Block entries based on AI news analysis
// ═══════════════════════════════════════════════════════════════════
NewsContextAnalysis newsContext;
lock (_analysisLock)
{
    newsContext = _currentNewsContext; // Get the latest analysis
}

if (newsContext != null && newsContext.BlockNewEntries)
{
    if (_config.EnableDebugLogging)
        _journal.Debug($"[GEMINI API] Entry BLOCKED: {newsContext.Reasoning}");
    return null; // Stop processing this signal
}

// OPTIONAL: You can also use the other values to adjust your confidence score:
// double newsConfidence = newsContext?.ConfidenceAdjustment ?? 0.0;
// double newsRiskMultiplier = newsContext?.RiskMultiplier ?? 1.0;
// Example: unifiedScore = (biasScore * 0.4) + (paScore * 0.4) + (newsConfidence * 0.2);
// Example: riskToUse = baseRisk * newsRiskMultiplier;
```

**Place this check AFTER the existing context storage (lines 3586-3589) but BEFORE the ICT gate check (lines 3591-3610).**

---

## Testing the Integration

### 1. Build the Bot
```bash
cd C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB_freshnew\CCTTB_freshnew
dotnet build --configuration Debug
```

### 2. Check for Compilation Errors
- Look for any errors related to `async`/`await` or `Task`
- Verify all `using` statements are correct
- Check that AccessRights in the [Robot] attribute is set appropriately (may need to change to `AccessRights.FullAccess` for HTTP calls)

### 3. Run a Backtest
- Load the bot in cTrader Automate
- Run a backtest on recent data (last 1-2 weeks)
- Check the cTrader Log tab for these messages:

**Good Messages (Working):**
```
[GEMINI API] Background news analysis timer started (15-minute interval)
[GEMINI API] News analysis updated: Normal market conditions. No significant news...
[Gemini] Analysis Received: Normal market conditions...
```

**If API is blocking entries:**
```
[GEMINI API] Entry BLOCKED: High-impact news (US CPI) in 20 minutes...
[Gemini] Analysis Received: High-impact news detected...
```

**Error Messages (Troubleshooting):**
```
[Gemini] ERROR: Workflow URL is not set in SmartNewsAnalyzer.cs!
    → Fix: Check that the URL is correct in Utils_SmartNewsAnalyzer.cs (line 111)

[Gemini] ERROR: API call failed: 403 (Forbidden)
    → Fix: Service Account needs "Vertex AI User" role in Google Cloud

[Gemini] ERROR: API call failed: 500 (Internal Server Error)
    → Fix: Check the Google Cloud Workflow logs for errors

[Gemini] ERROR: API exception: ...
    → Fix: Check network connectivity or API endpoint URL
```

---

## Important Notes

### AccessRights Requirement
The bot may need `AccessRights.FullAccess` to make HTTP calls. Update the [Robot] attribute:

```csharp
[Robot(TimeZone = TimeZones.EasternStandardTime, AccessRights = AccessRights.FullAccess)]
public class JadecapStrategy : Robot
```

### Fail-Safe Behavior
If the API fails for any reason, the `GetFailSafeContext()` method returns a blocking context with:
- `BlockNewEntries = true`
- `RiskMultiplier = 0.0`
- `ConfidenceAdjustment = -1.0`

This ensures the bot operates safely when the API is unavailable.

### Performance
- API is called every 15 minutes in the background
- Does NOT block trade execution (async/await)
- Thread-safe with lock mechanism
- Cached result used between API calls

---

## Quick Checklist

- [x] Utils_SmartNewsAnalyzer.cs updated with API code
- [ ] Add timer and lock fields to JadecapStrategy.cs (line 692)
- [ ] Modify OnStart() to initialize timer (line 1495)
- [ ] Add UpdateNewsAnalysis() method (line 1700)
- [ ] Add news blocking check to BuildTradeSignal() (line 3575)
- [ ] Update AccessRights to FullAccess
- [ ] Build and test

---

## File Locations
- Main strategy: `JadecapStrategy.cs` (4600+ lines)
- News analyzer: `Utils_SmartNewsAnalyzer.cs` (now with API integration)
- This guide: `GEMINI_API_INTEGRATION_GUIDE.md`

---

## Next Steps After Integration

1. Verify compilation with `dotnet build`
2. Run backtest to check log messages
3. Monitor for API errors
4. Adjust timer interval if needed (currently 15 minutes)
5. Fine-tune fail-safe behavior if too restrictive

---

Generated: 2025-10-31
Bot Version: CCTTB_freshnew
