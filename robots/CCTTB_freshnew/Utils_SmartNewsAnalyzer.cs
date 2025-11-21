/* COMPLETE FILE: Utils_SmartNewsAnalyzer.cs
  FIX #1: Made HttpClient non-static to fix "Key has already been added" crash on restart.
  FIX #2: Wrapped all _robot.Print() calls in BeginInvokeOnMainThread.
  FIX #3: Added Google Cloud OAuth authentication using service account credentials.
*/
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using cAlgo.API;
using cAlgo.API.Indicators;
using Google.Apis.Auth.OAuth2;

namespace CCTTB
{
    // --- NO CHANGES TO YOUR EXISTING ENUMS ---
    public enum NewsImpact
    {
        None, Low, Medium, High
    }

    public enum VolatilityReaction
    {
        Confirmation, Contradiction, Choppy, Normal
    }

    public enum NewsContext
    {
        PreHighImpact, PostConfirmation, PostContradiction, PostChoppy, Normal
    }

    // --- THIS IS YOUR EXISTING CLASS, NO CHANGES NEEDED ---
    public class NewsContextAnalysis
    {
        public NewsContext Context { get; set; }
        public VolatilityReaction Reaction { get; set; }
        public double ConfidenceAdjustment { get; set; }
        public double RiskMultiplier { get; set; }
        public bool BlockNewEntries { get; set; }
        public bool InvalidateBias { get; set; }
        public string Reasoning { get; set; }
        public DateTime? NextHighImpactNews { get; set; }
    }

    // --- THIS IS A NEW HELPER CLASS ---
    public class GeminiApiRequest
    {
        public string asset { get; set; }
        public string utc_time { get; set; }
        public string current_bias { get; set; }
        public int lookahead_minutes { get; set; }
    }

    // --- Wrapper class for Google Workflow API format ---
    // CRITICAL: Google Workflows API expects 'argument' as a JSON STRING, not an object
    public class WorkflowExecutionRequest
    {
        public string argument { get; set; }
    }


    // --- YOUR SmartNewsAnalyzer CLASS, NOW WITH API LOGIC ---
    public class SmartNewsAnalyzer
    {
        private readonly Robot _robot;
        private readonly bool _enableDebugLogging;

        // --- CRITICAL FIX: HttpClient is no longer static. ---
        // We will create/dispose it inside the GetGeminiAnalysis method.
        // This prevents the "Key has already been added" crash on bot restart.
        private readonly string _workflowApiUrl = "https://workflowexecutions.googleapis.com/v1/projects/my-trader-bot-api/locations/europe-west2/workflows/smart-news-api/executions";

        // --- RATE LIMITING: Track last API call to prevent rate limit issues ---
        private DateTime _lastApiCallTime = DateTime.MinValue;
        private readonly TimeSpan _minApiCallInterval = TimeSpan.FromMinutes(15);
        private int _consecutiveFailures = 0;
        private readonly int _maxConsecutiveFailures = 3;

        // --- FLEXIBLE CREDENTIAL PATHS: Check multiple locations ---
        // Priority order: 1) Environment variable, 2) User profile, 3) cAlgo directory, 4) Bot directory
        private readonly string[] _credentialSearchPaths = new string[]
        {
            // 1. Environment variable (most flexible for deployment)
            Environment.GetEnvironmentVariable("CCTTB_SERVICE_ACCOUNT_PATH") ?? "",

            // 2. User profile (works for any Windows user)
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Documents", "cAlgo", "ServiceAccount", "credentials.json"),

            // 3. cAlgo directory (shared location)
            @"C:\cAlgo\ServiceAccount\credentials.json",

            // 4. Bot directory (portable with bot files)
            Path.Combine(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location) ?? "", "credentials.json"),

            // 5. Legacy path (backward compatibility)
            @"C:\Users\Administrator\Documents\cAlgo\ServiceAccount\credentials.json"
        };

        public SmartNewsAnalyzer(Robot robot, bool enableDebugLogging)
        {
            _robot = robot;
            _enableDebugLogging = enableDebugLogging;

            // --- CRITICAL FIX: ---
            // The code that set up the HttpClient headers (which caused the crash)
            // has been moved inside the GetGeminiAnalysis method.
            // This constructor is now clean.
        }

        // --- IMPROVED: Find credentials file in multiple locations ---
        private string FindCredentialsFile()
        {
            foreach (var path in _credentialSearchPaths)
            {
                if (string.IsNullOrEmpty(path)) continue;

                if (File.Exists(path))
                {
                    _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] ✅ Found credentials at: {path}"));
                    return path;
                }
            }

            // Log all searched locations for troubleshooting
            _robot.BeginInvokeOnMainThread(() =>
            {
                _robot.Print("[Gemini] ❌ ERROR: Service account credentials not found!");
                _robot.Print("[Gemini] Searched locations:");
                _robot.Print($"  1. Environment variable CCTTB_SERVICE_ACCOUNT_PATH: {(_credentialSearchPaths[0] != "" ? _credentialSearchPaths[0] : "Not set")}");
                _robot.Print($"  2. User profile: {_credentialSearchPaths[1]}");
                _robot.Print($"  3. cAlgo directory: {_credentialSearchPaths[2]}");
                _robot.Print($"  4. Bot directory: {_credentialSearchPaths[3]}");
                _robot.Print($"  5. Legacy path: {_credentialSearchPaths[4]}");
                _robot.Print("[Gemini] SOLUTION: Place credentials.json in any of the above locations OR set CCTTB_SERVICE_ACCOUNT_PATH environment variable");
            });

            return null;
        }

        // --- IMPROVED: Method to get OAuth token with correct scope ---
        private async Task<string> GetAccessTokenAsync()
        {
            try
            {
                string credPath = FindCredentialsFile();
                if (string.IsNullOrEmpty(credPath))
                {
                    _consecutiveFailures++;
                    return null;
                }

                // Load service account credentials with Google Cloud Platform scope
                GoogleCredential credential;
                using (var stream = new FileStream(credPath, FileMode.Open, FileAccess.Read))
                {
#pragma warning disable CS0618 // GoogleCredential.FromStream is deprecated but still secure when using service account JSON files
                    credential = GoogleCredential.FromStream(stream)
                        .CreateScoped("https://www.googleapis.com/auth/cloud-platform");
#pragma warning restore CS0618
                }

                // Get access token using the modern async API
                var accessToken = await credential.UnderlyingCredential.GetAccessTokenForRequestAsync(
                    cancellationToken: System.Threading.CancellationToken.None);

                if (string.IsNullOrEmpty(accessToken))
                {
                    _robot.BeginInvokeOnMainThread(() => _robot.Print("[Gemini] ERROR: Received empty access token from Google"));
                    _consecutiveFailures++;
                    return null;
                }

                // Success! Reset failure counter
                _consecutiveFailures = 0;
                return accessToken;
            }
            catch (Exception ex)
            {
                _consecutiveFailures++;
                _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] ERROR: Failed to get access token: {ex.Message}"));
                return null;
            }
        }

        public async Task<NewsContextAnalysis> GetGeminiAnalysis(
            string asset,
            DateTime utcTime,
            BiasDirection currentBias,
            int lookaheadMinutes)
        {
            // --- RATE LIMITING: Check if enough time has passed since last call ---
            TimeSpan timeSinceLastCall = DateTime.UtcNow - _lastApiCallTime;
            if (timeSinceLastCall < _minApiCallInterval)
            {
                TimeSpan remaining = _minApiCallInterval - timeSinceLastCall;
                if (_enableDebugLogging)
                {
                    _robot.BeginInvokeOnMainThread(() =>
                        _robot.Print($"[Gemini] Rate limit: Skipping call (next call in {remaining.TotalMinutes:F1} minutes)"));
                }
                // Return the last cached analysis (fail-safe with normal parameters)
                return GetFailSafeContext($"Rate limited (next call in {remaining.TotalMinutes:F1} min)");
            }

            // --- CIRCUIT BREAKER: Stop calling API after too many consecutive failures ---
            if (_consecutiveFailures >= _maxConsecutiveFailures)
            {
                _robot.BeginInvokeOnMainThread(() =>
                    _robot.Print($"[Gemini] Circuit breaker: Too many failures ({_consecutiveFailures}), API calls temporarily disabled. Will retry after bot restart."));
                return GetFailSafeContext($"Circuit breaker active ({_consecutiveFailures} failures)");
            }

            if (string.IsNullOrEmpty(_workflowApiUrl) || _workflowApiUrl.Contains("PASTE_YOUR_URL"))
            {
                // --- FIX: Use BeginInvokeOnMainThread for Print ---
                _robot.BeginInvokeOnMainThread(() => _robot.Print("[Gemini] ERROR: Workflow URL is not set in SmartNewsAnalyzer.cs!"));
                _consecutiveFailures++;
                return GetFailSafeContext("API URL not configured.");
            }

            // --- UPDATE: Record this API call attempt ---
            _lastApiCallTime = DateTime.UtcNow;

            var requestPayload = new GeminiApiRequest
            {
                asset = asset,
                utc_time = utcTime.ToString("o"),
                current_bias = currentBias.ToString(),
                lookahead_minutes = lookaheadMinutes
            };

            // CRITICAL FIX: Serialize payload to JSON STRING first (Google Workflows expects string, not object)
            string argumentJsonString = JsonSerializer.Serialize(requestPayload);

            // Wrap JSON string in "argument" field for Google Workflow API
            var workflowRequest = new WorkflowExecutionRequest
            {
                argument = argumentJsonString
            };

            string jsonRequest = JsonSerializer.Serialize(workflowRequest);
            var httpContent = new StringContent(jsonRequest, Encoding.UTF8, "application/json");

            // --- NEW: Get OAuth access token ---
            string accessToken = await GetAccessTokenAsync();
            if (string.IsNullOrEmpty(accessToken))
            {
                _robot.BeginInvokeOnMainThread(() => _robot.Print("[Gemini] ERROR: Could not obtain access token"));
                return GetFailSafeContext("Failed to obtain access token");
            }

            // --- CRITICAL FIX: Create a new HttpClient for each call. ---
            // This is the standard, safe way to use HttpClient in modern .NET.
            // (We are using 'using' so it's disposed of properly)
            using (var httpClient = new HttpClient())
            {
                httpClient.DefaultRequestHeaders.Accept.Clear();
                httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                // --- NEW: Add Authorization header with Bearer token ---
                httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

                try
                {
                    HttpResponseMessage httpResponse = await httpClient.PostAsync(_workflowApiUrl, httpContent);

                    if (httpResponse.IsSuccessStatusCode)
                    {
                        string jsonResponse = await httpResponse.Content.ReadAsStringAsync();

                        NewsContextAnalysis analysis = JsonSerializer.Deserialize<NewsContextAnalysis>(
                            jsonResponse,
                            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                        );

                        // --- SUCCESS: Reset failure counter ---
                        _consecutiveFailures = 0;

                        if (_enableDebugLogging)
                        {
                            // --- FIX: Use BeginInvokeOnMainThread for Print ---
                            _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] ✅ Analysis Received: {analysis.Reasoning}"));
                        }

                        return analysis;
                    }
                    else
                    {
                        // --- FAILURE: Increment failure counter ---
                        _consecutiveFailures++;

                        string errorContent = await httpResponse.Content.ReadAsStringAsync();
                        // --- FIX: Use BeginInvokeOnMainThread for Print ---
                        _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] ⚠️ API call failed: {httpResponse.StatusCode}. Response: {errorContent}"));
                        _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] ✅ Proceeding with default risk parameters (trading enabled)"));
                        _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] Consecutive failures: {_consecutiveFailures}/{_maxConsecutiveFailures}"));
                        return GetFailSafeContext($"API call failed: {httpResponse.StatusCode}");
                    }
                }
                catch (Exception ex)
                {
                    // --- FAILURE: Increment failure counter ---
                    _consecutiveFailures++;

                    // --- FIX: Use BeginInvokeOnMainThread for Print ---
                    _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] ⚠️ API exception: {ex.Message}"));
                    _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] ✅ Proceeding with default risk parameters (trading enabled)"));
                    _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] Consecutive failures: {_consecutiveFailures}/{_maxConsecutiveFailures}"));
                    return GetFailSafeContext($"API exception: {ex.Message}");
                }
            } // The 'using' block disposes of the httpClient here.
        }

        private NewsContextAnalysis GetFailSafeContext(string reason)
        {
            // CRITICAL FIX: Changed BlockNewEntries from true to FALSE
            // This allows the bot to continue trading even when Gemini API is unavailable
            // The bot will use default risk parameters (RiskMultiplier = 1.0)
            return new NewsContextAnalysis
            {
                Context = NewsContext.Normal,
                Reaction = VolatilityReaction.Normal,
                ConfidenceAdjustment = 0.0,  // Changed from -1.0 to 0.0 (neutral adjustment)
                RiskMultiplier = 1.0,         // Changed from 0.0 to 1.0 (normal risk)
                BlockNewEntries = false,      // Changed from true to FALSE - ALLOWS TRADING
                InvalidateBias = false,
                Reasoning = "FAIL-SAFE: " + reason + " (proceeding with default risk parameters)",
                NextHighImpactNews = null
            };
        }

        // --- FALLBACK METHOD for backtest/synchronous calls ---
        // This is a simple fallback that returns "Normal" context.
        // Used when GetGeminiAnalysis() cannot be called (backtest mode, synchronous context, etc.)
        public NewsContextAnalysis AnalyzeNewsContext(BiasDirection currentBias, DateTime currentTime)
        {
            return new NewsContextAnalysis
            {
                Context = NewsContext.Normal,
                Reaction = VolatilityReaction.Normal,
                ConfidenceAdjustment = 0.0,
                RiskMultiplier = 1.0,
                BlockNewEntries = false,
                InvalidateBias = false,
                Reasoning = "Fallback: Normal market conditions (no API analysis available)",
                NextHighImpactNews = null
            };
        }
    }
}
