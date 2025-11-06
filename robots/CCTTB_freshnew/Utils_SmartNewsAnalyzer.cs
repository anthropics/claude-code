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
    public class WorkflowExecutionRequest
    {
        public GeminiApiRequest argument { get; set; }
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

        // --- NEW: Path to service account JSON file ---
        // IMPORTANT: Store this file securely, NOT in the repository!
        // Place it in: C:\Users\Administrator\Documents\cAlgo\ServiceAccount\credentials.json
        private readonly string _serviceAccountPath = @"C:\Users\Administrator\Documents\cAlgo\ServiceAccount\credentials.json";

        public SmartNewsAnalyzer(Robot robot, bool enableDebugLogging)
        {
            _robot = robot;
            _enableDebugLogging = enableDebugLogging;

            // --- CRITICAL FIX: ---
            // The code that set up the HttpClient headers (which caused the crash)
            // has been moved inside the GetGeminiAnalysis method.
            // This constructor is now clean.
        }

        // --- NEW: Method to get OAuth token from service account ---
        private async Task<string> GetAccessTokenAsync()
        {
            try
            {
                if (!File.Exists(_serviceAccountPath))
                {
                    _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] ERROR: Service account file not found at: {_serviceAccountPath}"));
                    return null;
                }

                // Use the modern CredentialFactory approach (non-deprecated)
                ServiceAccountCredential credential;
                using (var stream = new FileStream(_serviceAccountPath, FileMode.Open, FileAccess.Read))
                {
                    credential = ServiceAccountCredential.FromServiceAccountData(stream);
                }

                // Request access token with the required scope
                bool success = await credential.RequestAccessTokenAsync(System.Threading.CancellationToken.None);
                if (!success)
                {
                    _robot.BeginInvokeOnMainThread(() => _robot.Print("[Gemini] ERROR: Failed to request access token"));
                    return null;
                }

                return credential.Token.AccessToken;
            }
            catch (Exception ex)
            {
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
            if (string.IsNullOrEmpty(_workflowApiUrl) || _workflowApiUrl.Contains("PASTE_YOUR_URL"))
            {
                // --- FIX: Use BeginInvokeOnMainThread for Print ---
                _robot.BeginInvokeOnMainThread(() => _robot.Print("[Gemini] ERROR: Workflow URL is not set in SmartNewsAnalyzer.cs!"));
                return GetFailSafeContext("API URL not configured.");
            }

            var requestPayload = new GeminiApiRequest
            {
                asset = asset,
                utc_time = utcTime.ToString("o"),
                current_bias = currentBias.ToString(),
                lookahead_minutes = lookaheadMinutes
            };

            // Wrap payload in "argument" object for Google Workflow API
            var workflowRequest = new WorkflowExecutionRequest
            {
                argument = requestPayload
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

                        if (_enableDebugLogging)
                        {
                            // --- FIX: Use BeginInvokeOnMainThread for Print ---
                            _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] Analysis Received: {analysis.Reasoning}"));
                        }

                        return analysis;
                    }
                    else
                    {
                        string errorContent = await httpResponse.Content.ReadAsStringAsync();
                        // --- FIX: Use BeginInvokeOnMainThread for Print ---
                        _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] ⚠️ API call failed: {httpResponse.StatusCode}. Response: {errorContent}"));
                        _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] ✅ Proceeding with default risk parameters (trading enabled)"));
                        return GetFailSafeContext($"API call failed: {httpResponse.StatusCode}");
                    }
                }
                catch (Exception ex)
                {
                    // --- FIX: Use BeginInvokeOnMainThread for Print ---
                    _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] ⚠️ API exception: {ex.Message}"));
                    _robot.BeginInvokeOnMainThread(() => _robot.Print($"[Gemini] ✅ Proceeding with default risk parameters (trading enabled)"));
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
