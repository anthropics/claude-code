using System;
using System.Linq;
using cAlgo.API;
using cAlgo.API.Internals;

namespace CCTTB
{
    /// <summary>
    /// ADVANCED FEATURE: Enhanced Intermarket Analysis
    /// Monitors correlations between forex and other asset classes (bonds, indices, commodities)
    /// to improve signal quality and risk assessment.
    /// </summary>
    public enum MarketSentiment
    {
        RiskOn,     // Risk-seeking behavior (stocks up, safe havens down)
        RiskOff,    // Risk-averse behavior (stocks down, safe havens up)
        Neutral     // Mixed or unclear signals
    }

    public enum TrendDirection
    {
        Bullish,
        Bearish,
        Neutral
    }

    public class IntermarketCorrelation
    {
        public string AssetName { get; set; }
        public double CorrelationValue { get; set; }  // -1.0 to 1.0
        public TrendDirection Trend { get; set; }
        public double ChangePercent { get; set; }     // Recent price change %
        public bool IsAvailable { get; set; }         // Whether data is accessible
    }

    public class IntermarketAnalysis
    {
        private readonly Robot _robot;
        private readonly bool _enableDebugLogging;

        // Symbol references (may be null if not available)
        private Bars _bondBars;      // 10Y Treasury yield proxy (e.g., "US10Y")
        private Bars _spxBars;        // S&P 500 index
        private Bars _goldBars;       // Gold spot
        private Bars _oilBars;        // Oil futures

        // Configuration
        private readonly string _bondSymbol = "US10Y";
        private readonly string _spxSymbol = "US500";
        private readonly string _goldSymbol = "XAUUSD";
        private readonly string _oilSymbol = "USOIL";
        private readonly TimeFrame _analysisTimeframe = TimeFrame.Hour4;  // Use H4 for intermarket

        public IntermarketAnalysis(Robot robot, bool enableDebugLogging = false)
        {
            _robot = robot;
            _enableDebugLogging = enableDebugLogging;

            // Try to load intermarket symbols (may fail if not available with broker)
            TryLoadSymbol(_bondSymbol, out _bondBars);
            TryLoadSymbol(_spxSymbol, out _spxBars);
            TryLoadSymbol(_goldSymbol, out _goldBars);
            TryLoadSymbol(_oilSymbol, out _oilBars);

            if (_enableDebugLogging)
            {
                _robot.Print($"[INTERMARKET] Bond data: {(_bondBars != null ? "✅" : "❌")}");
                _robot.Print($"[INTERMARKET] SPX data: {(_spxBars != null ? "✅" : "❌")}");
                _robot.Print($"[INTERMARKET] Gold data: {(_goldBars != null ? "✅" : "❌")}");
                _robot.Print($"[INTERMARKET] Oil data: {(_oilBars != null ? "✅" : "❌")}");
            }
        }

        private bool TryLoadSymbol(string symbolName, out Bars bars)
        {
            try
            {
                var symbol = _robot.Symbols.GetSymbol(symbolName);
                if (symbol != null)
                {
                    bars = _robot.MarketData.GetBars(_analysisTimeframe, symbolName);
                    return bars != null && bars.Count > 20;
                }
            }
            catch { /* Symbol not available */ }

            bars = null;
            return false;
        }

        /// <summary>
        /// Analyze current market sentiment based on intermarket relationships
        /// </summary>
        public MarketSentiment GetMarketSentiment()
        {
            int riskOnSignals = 0;
            int riskOffSignals = 0;
            int totalSignals = 0;

            // 1. BONDS: Rising yields (bonds falling) = Risk On, Falling yields = Risk Off
            if (_bondBars != null && _bondBars.Count > 20)
            {
                double bondChange = GetRecentPriceChange(_bondBars, 10);
                totalSignals++;

                if (bondChange > 0.5)      // Yields rising > 0.5%
                    riskOnSignals++;
                else if (bondChange < -0.5) // Yields falling > 0.5%
                    riskOffSignals++;
            }

            // 2. EQUITIES: Rising stocks = Risk On, Falling stocks = Risk Off
            if (_spxBars != null && _spxBars.Count > 20)
            {
                double spxChange = GetRecentPriceChange(_spxBars, 10);
                totalSignals++;

                if (spxChange > 1.0)       // Stocks up > 1%
                    riskOnSignals++;
                else if (spxChange < -1.0)  // Stocks down > 1%
                    riskOffSignals++;
            }

            // 3. GOLD: Rising gold = Risk Off (safe haven), Falling = Risk On
            if (_goldBars != null && _goldBars.Count > 20)
            {
                double goldChange = GetRecentPriceChange(_goldBars, 10);
                totalSignals++;

                if (goldChange > 1.0)      // Gold up > 1%
                    riskOffSignals++;
                else if (goldChange < -1.0) // Gold down > 1%
                    riskOnSignals++;
            }

            // 4. OIL: Rising oil = Risk On (growth), Falling = Risk Off
            if (_oilBars != null && _oilBars.Count > 20)
            {
                double oilChange = GetRecentPriceChange(_oilBars, 10);
                totalSignals++;

                if (oilChange > 2.0)       // Oil up > 2%
                    riskOnSignals++;
                else if (oilChange < -2.0)  // Oil down > 2%
                    riskOffSignals++;
            }

            // Determine sentiment
            if (totalSignals == 0)
                return MarketSentiment.Neutral;

            double riskOnRatio = (double)riskOnSignals / totalSignals;
            double riskOffRatio = (double)riskOffSignals / totalSignals;

            if (riskOnRatio >= 0.6)       // 60%+ of signals are risk-on
                return MarketSentiment.RiskOn;
            else if (riskOffRatio >= 0.6) // 60%+ of signals are risk-off
                return MarketSentiment.RiskOff;
            else
                return MarketSentiment.Neutral;
        }

        /// <summary>
        /// Get detailed correlation data for all monitored assets
        /// </summary>
        public IntermarketCorrelation[] GetCorrelations()
        {
            var correlations = new System.Collections.Generic.List<IntermarketCorrelation>();

            // Bond correlation
            if (_bondBars != null && _bondBars.Count > 20)
            {
                correlations.Add(new IntermarketCorrelation
                {
                    AssetName = "US10Y",
                    CorrelationValue = 0.0, // Placeholder - real correlation calculation would require historical data
                    Trend = GetTrendDirection(_bondBars),
                    ChangePercent = GetRecentPriceChange(_bondBars, 10),
                    IsAvailable = true
                });
            }

            // SPX correlation
            if (_spxBars != null && _spxBars.Count > 20)
            {
                correlations.Add(new IntermarketCorrelation
                {
                    AssetName = "SPX500",
                    CorrelationValue = 0.0,
                    Trend = GetTrendDirection(_spxBars),
                    ChangePercent = GetRecentPriceChange(_spxBars, 10),
                    IsAvailable = true
                });
            }

            // Gold correlation
            if (_goldBars != null && _goldBars.Count > 20)
            {
                correlations.Add(new IntermarketCorrelation
                {
                    AssetName = "GOLD",
                    CorrelationValue = 0.0,
                    Trend = GetTrendDirection(_goldBars),
                    ChangePercent = GetRecentPriceChange(_goldBars, 10),
                    IsAvailable = true
                });
            }

            // Oil correlation
            if (_oilBars != null && _oilBars.Count > 20)
            {
                correlations.Add(new IntermarketCorrelation
                {
                    AssetName = "OIL",
                    CorrelationValue = 0.0,
                    Trend = GetTrendDirection(_oilBars),
                    ChangePercent = GetRecentPriceChange(_oilBars, 10),
                    IsAvailable = true
                });
            }

            return correlations.ToArray();
        }

        /// <summary>
        /// Calculate confidence adjustment factor based on intermarket alignment
        /// Returns 0.9-1.1 multiplier (0.9 = divergence, 1.0 = neutral, 1.1 = strong alignment)
        /// </summary>
        public double GetIntermarketConfidenceFactor(BiasDirection tradeDirection)
        {
            MarketSentiment sentiment = GetMarketSentiment();

            // EURUSD correlations:
            // - Risk On → EUR tends to strengthen (USD weakens) → Bullish EUR
            // - Risk Off → USD strengthens (safe haven) → Bearish EUR

            if (tradeDirection == BiasDirection.Bullish)
            {
                // Bullish EUR/USD trade
                if (sentiment == MarketSentiment.RiskOn)
                    return 1.1;  // Aligned with risk-on environment
                else if (sentiment == MarketSentiment.RiskOff)
                    return 0.9;  // Fighting risk-off sentiment
                else
                    return 1.0;  // Neutral
            }
            else if (tradeDirection == BiasDirection.Bearish)
            {
                // Bearish EUR/USD trade
                if (sentiment == MarketSentiment.RiskOff)
                    return 1.1;  // Aligned with risk-off environment (USD strength)
                else if (sentiment == MarketSentiment.RiskOn)
                    return 0.9;  // Fighting risk-on sentiment
                else
                    return 1.0;  // Neutral
            }

            return 1.0; // Default neutral
        }

        /// <summary>
        /// Calculate percentage price change over recent bars
        /// </summary>
        private double GetRecentPriceChange(Bars bars, int lookbackBars)
        {
            if (bars == null || bars.Count < lookbackBars + 1)
                return 0.0;

            double currentPrice = bars.ClosePrices.Last(0);
            double previousPrice = bars.ClosePrices.Last(lookbackBars);

            if (previousPrice == 0)
                return 0.0;

            return ((currentPrice - previousPrice) / previousPrice) * 100.0;
        }

        /// <summary>
        /// Determine trend direction using simple moving average crossover
        /// </summary>
        private TrendDirection GetTrendDirection(Bars bars)
        {
            if (bars == null || bars.Count < 50)
                return TrendDirection.Neutral;

            // Simple trend: current price vs 20-bar SMA
            double currentPrice = bars.ClosePrices.Last(0);
            double sma20 = 0;

            for (int i = 0; i < 20; i++)
            {
                sma20 += bars.ClosePrices.Last(i);
            }
            sma20 /= 20.0;

            double threshold = sma20 * 0.005; // 0.5% threshold

            if (currentPrice > sma20 + threshold)
                return TrendDirection.Bullish;
            else if (currentPrice < sma20 - threshold)
                return TrendDirection.Bearish;
            else
                return TrendDirection.Neutral;
        }

        /// <summary>
        /// Check if dollar is strengthening (useful for USD pairs)
        /// </summary>
        public bool IsDollarStrengthening()
        {
            // Dollar tends to strengthen when:
            // 1. Bonds yields rising (capital flows to USD)
            // 2. Risk-off sentiment (safe haven flows)
            // 3. Gold falling (inverse correlation)

            int dollarStrengthSignals = 0;
            int totalSignals = 0;

            if (_bondBars != null && _bondBars.Count > 20)
            {
                double bondChange = GetRecentPriceChange(_bondBars, 10);
                totalSignals++;
                if (bondChange > 0.5) dollarStrengthSignals++;
            }

            if (_goldBars != null && _goldBars.Count > 20)
            {
                double goldChange = GetRecentPriceChange(_goldBars, 10);
                totalSignals++;
                if (goldChange < -1.0) dollarStrengthSignals++;
            }

            MarketSentiment sentiment = GetMarketSentiment();
            totalSignals++;
            if (sentiment == MarketSentiment.RiskOff) dollarStrengthSignals++;

            if (totalSignals == 0) return false;

            return (double)dollarStrengthSignals / totalSignals >= 0.6; // 60%+ agreement
        }
    }
}
