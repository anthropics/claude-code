using System;
using System.Collections.Generic;
using System.Linq;
using cAlgo.API;
using cAlgo.API.Internals;
using cAlgo.API.Indicators;

namespace CCTTB
{
    public class TradeSignal
    {
        public string Label { get; set; } = "Jadecap-Pro";
        public BiasDirection Direction { get; set; }
        public double EntryPrice { get; set; }
        public double StopLoss { get; set; }
        public double TakeProfit { get; set; }
        public DateTime Timestamp { get; set; }
        public OTEZone OTEZone { get; set; }
        public OrderBlock OrderBlock { get; set; }

        // PHASE 1B CHANGE #3: Track MSS timestamp for late MSS risk reduction
        public DateTime? MSSTimestamp { get; set; }  // When the MSS was created

        // PHASE 4: Dynamic Risk Allocation - Confidence Score
        public double ConfidenceScore { get; set; } = 0.5;  // 0.0-1.0 (default neutral)
    }

    public class TradeManager
    {
        /// <summary>
        /// Choose a take-profit price based on unified TP target policy (mapped to legacy flags by ApplyUnifiedPolicies).
        /// Falls back to RR or existing signal TP if no target is available.
        /// </summary>
        private double ChooseTakeProfit(TradeSignal signal)
        {
            try
            {
                // If signal comes with explicit TP, prefer it.
                if (signal.TakeProfit > 0) return signal.TakeProfit;

                // Pull data we might need
                var symbol   = _robot.Symbol;
                var bars     = _robot.MarketData.GetBars(_robot.TimeFrame);
                bool isBuy   = signal.StopLoss < signal.EntryPrice;

                // Helper to clamp and ensure sensible distance
                double EnsureMinDistance(double tp)
                {
                    double minPips = Math.Max(2.0, _config.MinTakeProfitPips);
                    double pip = symbol.PipSize;
                    if (isBuy && (tp - signal.EntryPrice) / pip < minPips) tp = signal.EntryPrice + minPips * pip;
                    if (!isBuy && (signal.EntryPrice - tp) / pip < minPips) tp = signal.EntryPrice - minPips * pip;
                    return tp;
                }

                // Use mapped legacy flags (set by ApplyUnifiedPolicies)
                if (_config.UseOppositeLiquidityTP)
                {
                    var liq = _robot.MarketData?.GetOppositeLiquidityLevels(isBuy);
                    if (liq != null && liq.Price > 0)
                    {
                        return EnsureMinDistance(liq.Price);
                    }
                }
                if (_config.UseWeeklyLiquidityTP)
                {
                    var w = _robot.MarketData?.GetWeeklyHighLow(isBuy);
                    if (w != null && w.TargetPrice > 0)
                    {
                        return EnsureMinDistance(w.TargetPrice);
                    }
                }
                if (_config.EnableInternalLiquidityFocus)
                {
                    var il = _robot.MarketData?.GetNearestInternalBoundary(isBuy);
                    if (il != null && il.Price > 0)
                    {
                        return EnsureMinDistance(il.Price);
                    }
                }

                // Fallback: use RR if configured, otherwise a small multiple of risk
                if (_config.DefaultTakeProfitRR > 0)
                {
                    double risk = Math.Abs(signal.EntryPrice - signal.StopLoss);
                    double rr = Math.Max(1.0, _config.DefaultTakeProfitRR);
                    return isBuy ? signal.EntryPrice + rr * risk : signal.EntryPrice - rr * risk;
                }

                // Final fallback: return 0 to let downstream logic compute default
                return 0;
            }
            catch { return 0; }
        }
    
        private readonly Robot _robot;
        private readonly StrategyConfig _config;
        private readonly RiskManager _riskManager;
        private RelativeStrengthIndex _rsi; // ADVANCED FEATURE: Nuanced Exit Logic
        private AverageTrueRange _atr; // ADVANCED FEATURE: For failure swing detection
        private PriceActionAnalyzer _priceActionAnalyzer; // ADVANCED FEATURE: Price action momentum exits
        private Symbol Symbol => _robot.Symbol; // Quick access to symbol

        // State for management
        private readonly Dictionary<long, double> _initRiskPips = new Dictionary<long, double>();
        private readonly HashSet<long> _beApplied   = new HashSet<long>();
        private readonly HashSet<long> _partialDone = new HashSet<long>();
        private readonly Dictionary<long, DateTime> _positionOpenTimes = new Dictionary<long, DateTime>(); // Track position open times
        private readonly Dictionary<long, double> _positionConfidences = new Dictionary<long, double>(); // ADVANCED FEATURE: Track confidence per position

        public TradeManager(Robot robot, StrategyConfig config, RiskManager riskManager)
        {
            _robot = robot;
            _config = config;
            _riskManager = riskManager;
        }

        // ADVANCED FEATURE: Set RSI indicator for nuanced exits
        public void SetRSI(RelativeStrengthIndex rsi)
        {
            _rsi = rsi;
        }

        // ADVANCED FEATURE: Set ATR indicator for failure swing detection
        public void SetATR(AverageTrueRange atr)
        {
            _atr = atr;
        }

        // ADVANCED FEATURE: Set Price Action Analyzer for momentum-based exits
        public void SetPriceActionAnalyzer(PriceActionAnalyzer analyzer)
        {
            _priceActionAnalyzer = analyzer;
        }

        // ADVANCED FEATURE: Get confidence score for a position (for self-diagnosis)
        public double GetPositionConfidence(long positionId)
        {
            return _positionConfidences.ContainsKey(positionId) ? _positionConfidences[positionId] : 0.5;
        }

        public bool CanOpenNewTrade(TradeSignal signal = null)
        {
            try
            {
                var positions = _robot.Positions
                    .Where(p => p.SymbolName == _robot.Symbol.Name && (p.Label != null && p.Label.StartsWith("Jadecap")))
                    .ToList();
                if (positions.Count < Math.Max(1, _config.MaxConcurrentPositions)) return true;

                if (signal == null) return false;
                // If at capacity, allow replacement only if no position in the same direction exists
                bool wantBuy = signal.StopLoss < signal.EntryPrice;
                bool hasSameDir = positions.Any(p => (p.TradeType == TradeType.Buy) == wantBuy);
                return !hasSameDir;
            }
            catch { return false; }
        }

        public void ExecuteTrade(TradeSignal signal)
        {
            _robot.Print($"[TRADE_MANAGER] ExecuteTrade called");
            if (signal == null)
            {
                _robot.Print($"[TRADE_MANAGER] BLOCKED: signal is null");
                return;
            }

            _robot.Print($"[TRADE_MANAGER] Signal: {signal.Label} {signal.Direction} @ Entry={signal.EntryPrice:F5} SL={signal.StopLoss:F5} TP={signal.TakeProfit:F5}");

            var symbol = _robot.Symbol;
            double pip = symbol.PipSize;

            // ═══════════════════════════════════════════════════════════════
            // PHASE 1A CHANGE #1: ATR Z-Score Adaptive Stop Loss System
            // ═══════════════════════════════════════════════════════════════

            // Calculate base SL distance from signal
            double baseSLPips = Math.Abs(signal.EntryPrice - signal.StopLoss) / pip;

            // Calculate ATR with Z-score for volatility adaptation
            double atrPips = 0;
            double atrMultiplier = 1.5;  // Default (normal volatility)
            double zScore = 0;

            if (_robot.Bars != null && _robot.Bars.Count >= 30)
            {
                // Calculate 20 historical ATR values for Z-score
                double[] atrValues = new double[20];
                var bars = _robot.Bars;

                for (int j = 0; j < 20; j++)
                {
                    int startIdx = bars.Count - 30 + j;
                    double sum = 0;
                    for (int i = startIdx; i < startIdx + 10 && i < bars.Count - 1; i++)
                    {
                        double tr = Math.Max(bars.HighPrices[i] - bars.LowPrices[i],
                                      Math.Max(Math.Abs(bars.HighPrices[i] - bars.ClosePrices[i - 1]),
                                               Math.Abs(bars.LowPrices[i] - bars.ClosePrices[i - 1])));
                        sum += tr;
                    }
                    atrValues[j] = (sum / 10.0) / pip;
                }

                // Current ATR (last 10 bars)
                double atrSum = 0;
                for (int i = bars.Count - 11; i < bars.Count - 1; i++)
                {
                    double tr = Math.Max(bars.HighPrices[i] - bars.LowPrices[i],
                                  Math.Max(Math.Abs(bars.HighPrices[i] - bars.ClosePrices[i - 1]),
                                           Math.Abs(bars.LowPrices[i] - bars.ClosePrices[i - 1])));
                    atrSum += tr;
                }
                atrPips = (atrSum / 10.0) / pip;

                // Calculate mean and standard deviation of historical ATR
                double meanATR = atrValues.Average();
                double variance = atrValues.Sum(v => Math.Pow(v - meanATR, 2)) / atrValues.Length;
                double stdDev = Math.Sqrt(variance);

                // Calculate Z-score: (current - mean) / stddev
                zScore = stdDev > 0 ? (atrPips - meanATR) / stdDev : 0;

                // Adaptive multiplier based on Z-score
                if (zScore <= -0.5)
                    atrMultiplier = 1.2;  // Low volatility → tighter stop
                else if (zScore >= 0.5)
                    atrMultiplier = 1.8;  // High volatility → wider stop
                else
                    atrMultiplier = 1.5;  // Normal volatility

                if (_config.EnableDebugLogging)
                {
                    _robot.Print($"[SL_CALC] ATR Z-Score Analysis:");
                    _robot.Print($"[SL_CALC]   Current ATR: {atrPips:F2} pips");
                    _robot.Print($"[SL_CALC]   Mean ATR (20-period): {meanATR:F2} pips");
                    _robot.Print($"[SL_CALC]   Std Dev: {stdDev:F2} pips");
                    _robot.Print($"[SL_CALC]   Z-Score: {zScore:F2}");
                    _robot.Print($"[SL_CALC]   ATR Multiplier: {atrMultiplier:F2}x");
                }
            }
            else
            {
                // Fallback: simple ATR calculation if insufficient bars
                if (_robot.Bars != null && _robot.Bars.Count >= 12)
                {
                    double atrSum = 0;
                    var bars = _robot.Bars;
                    for (int i = bars.Count - 11; i < bars.Count - 1; i++)
                    {
                        double tr = Math.Max(bars.HighPrices[i] - bars.LowPrices[i],
                                      Math.Max(Math.Abs(bars.HighPrices[i] - bars.ClosePrices[i - 1]),
                                               Math.Abs(bars.LowPrices[i] - bars.ClosePrices[i - 1])));
                        atrSum += tr;
                    }
                    atrPips = (atrSum / 10.0) / pip;
                }
            }

            // Apply ATR-based minimum SL
            double atrMinSL = atrPips * atrMultiplier;
            double slPips = Math.Max(baseSLPips, Math.Max(_config.MinSlPipsFloor, atrMinSL));

            // ═══════════════════════════════════════════════════════════════
            // OCT 30 ENHANCEMENT #1: SAFETY CLAMPS (15-50 pips for M5 EURUSD)
            // ═══════════════════════════════════════════════════════════════
            // Prevent catastrophic SL distances (too tight or too wide)
            double minSLPips = 15.0;  // M5 EURUSD minimum (survives noise)
            double maxSLPips = 50.0;  // M5 EURUSD maximum (prevent excessive risk)

            if (slPips < minSLPips)
            {
                if (_config.EnableDebugLogging)
                    _robot.Print($"[SL_CLAMP] ⚠️ SL too tight: {slPips:F2} pips → Clamped to {minSLPips:F2} pips");
                slPips = minSLPips;
            }
            else if (slPips > maxSLPips)
            {
                if (_config.EnableDebugLogging)
                    _robot.Print($"[SL_CLAMP] ⚠️ SL too wide: {slPips:F2} pips → Clamped to {maxSLPips:F2} pips");
                slPips = maxSLPips;
            }

            if (_config.EnableDebugLogging)
            {
                _robot.Print($"[SL_CALC] Stop Loss Calculation:");
                _robot.Print($"[SL_CALC]   Base SL from signal: {baseSLPips:F2} pips");
                _robot.Print($"[SL_CALC]   MinSlPipsFloor: {_config.MinSlPipsFloor:F2} pips");
                _robot.Print($"[SL_CALC]   ATR-based minimum: {atrMinSL:F2} pips");
                _robot.Print($"[SL_CALC]   FINAL SL distance (after clamps): {slPips:F2} pips (min={minSLPips:F2}, max={maxSLPips:F2})");
            }

            double effStop = signal.EntryPrice > signal.StopLoss
                ? signal.EntryPrice - slPips * pip
                : signal.EntryPrice + slPips * pip;

            // ═══════════════════════════════════════════════════════════════
            // PHASE 1A CHANGE #2: Spread/ATR Guard (Graduated Threshold)
            // ═══════════════════════════════════════════════════════════════

            double spread = symbol.Spread / pip;
            double spreadAtrRatio = atrPips > 0 ? spread / atrPips : 0;
            double volumeMultiplier = 1.0;

            if (spreadAtrRatio >= 0.40)
            {
                if (_config.EnableDebugLogging)
                    _robot.Print($"[SPREAD_GUARD] ❌ BLOCKED: Spread/ATR = {spreadAtrRatio:F3} (≥ 0.40) | Spread={spread:F2}p ATR={atrPips:F2}p");
                return;  // Skip trade entirely
            }
            else if (spreadAtrRatio >= 0.25)
            {
                volumeMultiplier = 0.5;  // Halve position size
                if (_config.EnableDebugLogging)
                    _robot.Print($"[SPREAD_GUARD] ⚠️ WARNING: Spread/ATR = {spreadAtrRatio:F3} (≥ 0.25) | Halving position size to {volumeMultiplier:F2}x");
            }
            else
            {
                if (_config.EnableDebugLogging)
                    _robot.Print($"[SPREAD_GUARD] ✅ PASS: Spread/ATR = {spreadAtrRatio:F3} (< 0.25) | Spread={spread:F2}p ATR={atrPips:F2}p");
            }

            // CRITICAL DEBUG LOGGING (Oct 23, 2025): Track volume calculation and actual execution
            _robot.Print($"═══════════════════════════════════════════════════════════════");
            _robot.Print($"[TRADE_EXEC] Calling CalculatePositionSize... | Confidence: {signal.ConfidenceScore:F2}");
            double volume = _riskManager.CalculatePositionSize(signal.EntryPrice, effStop, symbol, signal.ConfidenceScore);
            _robot.Print($"[TRADE_EXEC] Returned volume: {volume:F2} units ({volume / symbol.LotSize:F4} lots)");

            // Apply spread guard volume multiplier
            if (volumeMultiplier < 1.0)
            {
                volume = symbol.NormalizeVolumeInUnits(volume * volumeMultiplier);
                volume = Math.Max(volume, symbol.VolumeInUnitsMin);
                _robot.Print($"[TRADE_EXEC] After spread guard adjustment: {volume:F2} units ({volume / symbol.LotSize:F4} lots)");
            }

            // ═══════════════════════════════════════════════════════════════
            // PHASE 1B CHANGE #3: Late MSS Risk Reduction
            // ═══════════════════════════════════════════════════════════════
            // If MSS is near timeout (>45 min old), halve position size to reduce risk
            // Reasoning: Late MSS entries are less reliable (market already moved significantly)

            if (signal.MSSTimestamp.HasValue)
            {
                TimeSpan mssAge = _robot.Server.TimeInUtc - signal.MSSTimestamp.Value;
                double mssAgeMinutes = mssAge.TotalMinutes;

                if (mssAgeMinutes > 45.0)  // More than 75% of 60min timeout
                {
                    double originalVolume = volume;
                    volume = symbol.NormalizeVolumeInUnits(volume * 0.50);  // Halve position size
                    volume = Math.Max(volume, symbol.VolumeInUnitsMin);

                    if (_config.EnableDebugLogging)
                    {
                        _robot.Print($"[LATE_MSS] MSS age: {mssAgeMinutes:F1} min (> 45 min threshold)");
                        _robot.Print($"[LATE_MSS] Reducing position size: {originalVolume:F2} → {volume:F2} units (50% reduction)");
                        _robot.Print($"[LATE_MSS] Reason: Late MSS entry (less reliable, market already moved)");
                    }
                }
                else if (_config.EnableDebugLogging)
                {
                    _robot.Print($"[LATE_MSS] ✅ MSS age: {mssAgeMinutes:F1} min (< 45 min) - Full position size");
                }
            }

            // Notional cap guard
            if (_config.EnforceNotionalCap)
            {
                double mid = (symbol.Bid + symbol.Ask) * 0.5;
                double notional = volume * mid;
                double cap = _config.NotionalCapMultiple * _robot.Account.Equity;
                if (notional > cap && cap > 0)
                {
                    double ratio = cap / notional;
                    volume = symbol.NormalizeVolumeInUnits(volume * ratio);
                    volume = Math.Max(volume, symbol.VolumeInUnitsMin);
                }
            }
            // Margin check (approximate): required margin ~ notional / leverage
            if (_config.EnableMarginCheck)
            {
                double mid = (symbol.Bid + symbol.Ask) * 0.5;
                // Margin: approximate using precise leverage or default assumption
                double pl = _robot.Account.PreciseLeverage;
                double leverage = pl > 0 ? pl : _config.DefaultLeverageAssumption;
                double requiredMargin = (volume * mid) / Math.Max(1.0, leverage);
                double allowable = _robot.Account.FreeMargin * Math.Max(0.0, Math.Min(1.0, _config.MarginUtilizationMax));
                if (requiredMargin > allowable && allowable > 0)
                {
                    double ratio = allowable / requiredMargin;
                    volume = symbol.NormalizeVolumeInUnits(volume * ratio);
                    volume = Math.Max(volume, symbol.VolumeInUnitsMin);
                }
            }
            // Risk HUD (compact)
            try
            {
                double mid = (symbol.Bid + symbol.Ask) * 0.5;
                double equity = _robot.Account.Equity;
                double riskAmt = equity * (_config.RiskPercent / 100.0);
                double slPipsHud = Math.Abs(signal.EntryPrice - signal.StopLoss) / symbol.PipSize;
                // ATR(14) pips
                double atrPipsHud = 0;
                if (_robot.Bars != null && _robot.Bars.Count >= 16)
                {
                    int n = 14; var bars = _robot.Bars; double sum = 0;
                    for (int i = bars.Count - n - 1; i < bars.Count - 1; i++)
                    {
                        double tr = Math.Max(bars.HighPrices[i] - bars.LowPrices[i],
                                      Math.Max(Math.Abs(bars.HighPrices[i] - bars.ClosePrices[i - 1]),
                                               Math.Abs(bars.LowPrices[i] - bars.ClosePrices[i - 1])));
                        sum += tr;
                    }
                    atrPipsHud = (sum / n) / symbol.PipSize;
                }
                double pvpu = (symbol.LotSize > 0) ? (symbol.PipValue / symbol.LotSize) : (10.0 / 100000.0);
                double notional = volume * mid;
                double levHud = _robot.Account.PreciseLeverage > 0 ? _robot.Account.PreciseLeverage : _config.DefaultLeverageAssumption;
                double reqMarginHud = notional / Math.Max(1.0, levHud);
                double allowHud = _robot.Account.FreeMargin * Math.Max(0.0, Math.Min(1.0, _config.MarginUtilizationMax));
                double mPct = (allowHud > 0) ? (reqMarginHud / allowHud * 100.0) : 0.0;
                _robot.Print("[RiskHUD] Eq:{0:F2} Risk$:{1:F2} SL:{2:F1}p ATR14:{3:F1}p Units:{4:N0} Notional:{5:F2} Margin:{6:F2}/{7:F2}({8:F1}%) PipVal/Unit:{9:F6}",
                    equity, riskAmt, slPipsHud, atrPipsHud, volume, notional, reqMarginHud, allowHud, mPct, pvpu);
            }
            catch { }

            double takeProfit = ChooseTakeProfit(signal);

            if (!_riskManager.IsRiskRewardAcceptable(signal.EntryPrice, signal.StopLoss, takeProfit))
            {
                _robot.Print("Trade rejected: Risk/Reward not acceptable");
                return;
            }

            // Determine side strictly from SL vs Entry (bulletproof)
            TradeType tradeType;
            if (signal.StopLoss < signal.EntryPrice) tradeType = TradeType.Buy;
            else if (signal.StopLoss > signal.EntryPrice) tradeType = TradeType.Sell;
            else
            {
                _robot.Print("[TRADE_MANAGER] BLOCKED: StopLoss equals Entry (invalid).");
                return;
            }

            _robot.Print($"[TRADE_MANAGER] Executing market order: {tradeType} {volume} units | SL={Math.Abs(signal.EntryPrice - signal.StopLoss) / symbol.PipSize:F1}pips | TP={Math.Abs(takeProfit - signal.EntryPrice) / symbol.PipSize:F1}pips");

            // ═══════════════════════════════════════════════════════════════
            // PHASE 1A CHANGE #3: Order Compliance Checks
            // ═══════════════════════════════════════════════════════════════

            double slPipsParam = Math.Abs(signal.EntryPrice - signal.StopLoss) / symbol.PipSize;
            double tpPipsParam = Math.Abs(takeProfit - signal.EntryPrice) / symbol.PipSize;

            // Check #1: Volume validation
            if (volume < symbol.VolumeInUnitsMin || volume > symbol.VolumeInUnitsMax)
            {
                if (_config.EnableDebugLogging)
                    _robot.Print($"[BROKER_CHECK] ❌ BLOCKED: Volume {volume:F2} outside broker limits [{symbol.VolumeInUnitsMin:F2}, {symbol.VolumeInUnitsMax:F2}]");
                return;
            }

            // Check #2: RR validation after broker rounding
            // Simulate broker's price rounding (typically 5 digits for forex)
            double entryRounded = Math.Round(signal.EntryPrice, symbol.Digits);
            double slRounded = Math.Round(effStop, symbol.Digits);
            double tpRounded = Math.Round(takeProfit, symbol.Digits);

            double actualSLPips = Math.Abs(entryRounded - slRounded) / pip;
            double actualTPPips = Math.Abs(tpRounded - entryRounded) / pip;
            double actualRR = actualSLPips > 0 ? actualTPPips / actualSLPips : 0;

            if (_config.EnableDebugLogging)
            {
                _robot.Print($"[TP_CALC] Take Profit Analysis:");
                _robot.Print($"[TP_CALC]   Entry: {signal.EntryPrice:F5} → Rounded: {entryRounded:F5}");
                _robot.Print($"[TP_CALC]   SL: {effStop:F5} → Rounded: {slRounded:F5} | Distance: {actualSLPips:F2} pips");
                _robot.Print($"[TP_CALC]   TP: {takeProfit:F5} → Rounded: {tpRounded:F5} | Distance: {actualTPPips:F2} pips");
                _robot.Print($"[TP_CALC]   Actual RR after rounding: {actualRR:F2}:1");
                _robot.Print($"[TP_CALC]   MinRR Threshold: {_config.MinRiskReward:F2}:1");
            }

            if (actualRR < _config.MinRiskReward)
            {
                if (_config.EnableDebugLogging)
                    _robot.Print($"[BROKER_CHECK] ❌ BLOCKED: Actual RR {actualRR:F2}:1 < MinRR {_config.MinRiskReward:F2}:1 (after broker rounding)");
                return;
            }

            // Check #3: SL/TP direction validation
            bool isBuy = tradeType == TradeType.Buy;
            if ((isBuy && slRounded >= entryRounded) || (!isBuy && slRounded <= entryRounded))
            {
                if (_config.EnableDebugLogging)
                    _robot.Print($"[BROKER_CHECK] ❌ BLOCKED: SL in wrong direction ({tradeType}: SL={slRounded:F5} vs Entry={entryRounded:F5})");
                return;
            }
            if ((isBuy && tpRounded <= entryRounded) || (!isBuy && tpRounded >= entryRounded))
            {
                if (_config.EnableDebugLogging)
                    _robot.Print($"[BROKER_CHECK] ❌ BLOCKED: TP in wrong direction ({tradeType}: TP={tpRounded:F5} vs Entry={entryRounded:F5})");
                return;
            }

            if (_config.EnableDebugLogging)
                _robot.Print($"[BROKER_CHECK] ✅ PASS: All compliance checks passed | Volume={volume:F2} RR={actualRR:F2}:1");

            // CRITICAL DEBUG LOGGING (Oct 23, 2025): Log exact parameters sent to ExecuteMarketOrder
            _robot.Print($"[TRADE_EXEC] ExecuteMarketOrder params:");
            _robot.Print($"[TRADE_EXEC]   TradeType={tradeType}");
            _robot.Print($"[TRADE_EXEC]   Symbol={symbol.Name}");
            _robot.Print($"[TRADE_EXEC]   Volume={volume:F2} units ({volume / symbol.LotSize:F4} lots)");
            _robot.Print($"[TRADE_EXEC]   Label={signal.Label ?? "Jadecap-Pro"}");
            _robot.Print($"[TRADE_EXEC]   SL={slPipsParam:F2} pips (Price: {signal.StopLoss:F5})");
            _robot.Print($"[TRADE_EXEC]   TP={tpPipsParam:F2} pips (Price: {takeProfit:F5})");

            var result = _robot.ExecuteMarketOrder(
                tradeType,
                symbol.Name,
                volume,
                signal.Label ?? "Jadecap-Pro",
                slPipsParam,
                tpPipsParam
            );

            if (result.IsSuccessful)
            {
                var pos = result.Position;
                if (pos != null)
                {
                    double initRiskPips = Math.Abs(signal.EntryPrice - signal.StopLoss) / symbol.PipSize;
                    _initRiskPips[pos.Id] = Math.Max(initRiskPips, 1e-6); // avoid div/0

                    // ADVANCED FEATURE: Track position open time for time-based exits
                    _positionOpenTimes[pos.Id] = _robot.Server.Time;

                    // ADVANCED FEATURE: Track confidence score for self-diagnosis
                    _positionConfidences[pos.Id] = signal.ConfidenceScore;

                    // CRITICAL DEBUG LOGGING: Log actual executed position details
                    _robot.Print($"[TRADE_EXEC] ✅ POSITION OPENED:");
                    _robot.Print($"[TRADE_EXEC]   Position ID: {pos.Id}");
                    _robot.Print($"[TRADE_EXEC]   Entry Price: {pos.EntryPrice:F5}");
                    _robot.Print($"[TRADE_EXEC]   Volume: {pos.VolumeInUnits:F2} units ({pos.VolumeInUnits / symbol.LotSize:F4} lots)");
                    _robot.Print($"[TRADE_EXEC]   Stop Loss: {pos.StopLoss?.ToString("F5") ?? "null"}");
                    _robot.Print($"[TRADE_EXEC]   Take Profit: {pos.TakeProfit?.ToString("F5") ?? "null"}");
                    _robot.Print($"[TRADE_EXEC]   Expected loss at SL: ${initRiskPips * (symbol.PipValue / symbol.LotSize) * pos.VolumeInUnits:F2}");
                }
                _robot.Print($"[TRADE_EXEC] Trade executed: {tradeType} {volume} units at {signal.EntryPrice}");
                _robot.Print($"═══════════════════════════════════════════════════════════════");
            }
            else
            {
                _robot.Print($"[TRADE_EXEC] ❌ TRADE FAILED: {result.Error}");
                _robot.Print($"═══════════════════════════════════════════════════════════════");
            }
        }

        public void ManageOpenPositions(Symbol symbol)
        {
            if (_robot.Positions.Count == 0)
                return;

            double pip = symbol.PipSize;

            foreach (var p in _robot.Positions.Where(x => x.SymbolName == symbol.Name && (x.Label != null && x.Label.StartsWith("Jadecap"))).ToList())
            {
                bool isBuy = p.TradeType == TradeType.Buy;
                double entry = p.EntryPrice;
                double current = isBuy ? symbol.Bid : symbol.Ask;
                int dir = isBuy ? +1 : -1;

                double currentFavorablePips = (current - entry) * dir / pip;
                double initRiskPips = _initRiskPips.TryGetValue(p.Id, out var irp) ? irp : GuessInitRiskPips(p, symbol);

                double currentRR = initRiskPips > 0 ? (currentFavorablePips / initRiskPips) : 0.0;

                // --- Break-even ---
                if (_config.EnableBreakEven && !_beApplied.Contains(p.Id))
                {
                    bool rrTrig   = _config.BreakEvenTriggerRR   > 0 && currentRR >= _config.BreakEvenTriggerRR;
                    bool pipsTrig = _config.BreakEvenTriggerPips > 0 && currentFavorablePips >= _config.BreakEvenTriggerPips;

                    if (rrTrig || pipsTrig)
                    {
                        double newSL = isBuy
                            ? entry + _config.BreakEvenOffsetPips * pip
                            : entry - _config.BreakEvenOffsetPips * pip;

                        if (ShouldImproveSL(p, newSL, isBuy))
                        {
                            if (!_robot.Positions.Any(x => x.Id == p.Id)) continue;
                            var r = ModifyPositionCompat(p, newSL, p.TakeProfit);
                            if (r.IsSuccessful) _beApplied.Add(p.Id);
                        }
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // PHASE 1B CHANGE #1: Partial Exit at 1.5R (My Adjustment from ChatGPT's 1R)
                // ═══════════════════════════════════════════════════════════════
                // Close 50% at 1.5R to lock in profit, let 50% run to full TP2 (HTF liquidity)

                if (_config.EnablePartialClose && !_partialDone.Contains(p.Id))
                {
                    // FIXED: Trigger at 1.5R instead of config value (which may be 0.5R or 1.0R)
                    double targetRR = 1.5;  // Lock in 1.5× risk as profit

                    if (currentRR >= targetRR)
                    {
                        // Close 50% of position (lock in gains)
                        double volToClose = p.VolumeInUnits * 0.50;
                        volToClose = symbol.NormalizeVolumeInUnits(volToClose);

                        if (volToClose >= symbol.VolumeInUnitsMin && volToClose < p.VolumeInUnits)
                        {
                            if (!_robot.Positions.Any(x => x.Id == p.Id)) continue;

                            if (_config.EnableDebugLogging)
                            {
                                _robot.Print($"[PARTIAL_EXIT] Position {p.Id} at {currentRR:F2}R (≥ {targetRR}R):");
                                _robot.Print($"[PARTIAL_EXIT]   Closing 50% ({volToClose:F2} units of {p.VolumeInUnits:F2})");
                                _robot.Print($"[PARTIAL_EXIT]   Locking profit: ${currentFavorablePips * (symbol.PipValue / symbol.LotSize) * volToClose:F2}");
                                _robot.Print($"[PARTIAL_EXIT]   Remaining 50% runs to full TP2 (HTF liquidity)");
                            }

                            var r = _robot.ClosePosition(p, volToClose);
                            if (r.IsSuccessful)
                            {
                                _partialDone.Add(p.Id);
                                _robot.Print($"[PARTIAL_EXIT] ✅ Partial close successful | Remaining volume: {p.VolumeInUnits - volToClose:F2}");
                            }
                            else
                            {
                                _robot.Print($"[PARTIAL_EXIT] ❌ Partial close failed: {r.Error}");
                            }
                        }
                        else
                        {
                            _partialDone.Add(p.Id); // avoid spamming if too small
                            if (_config.EnableDebugLogging)
                                _robot.Print($"[PARTIAL_EXIT] Skipped: Volume too small ({volToClose:F2} < min {symbol.VolumeInUnitsMin:F2})");
                        }
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // PHASE 5: STRUCTURE-BASED EXIT - Close on opposing MSS
                // ═══════════════════════════════════════════════════════════════
                // Check for new opposing MSS and tighten SL or close position
                // This requires reading current bars to detect fresh structure breaks

                var bars = _robot.MarketData.GetBars(_robot.TimeFrame);
                if (bars != null && bars.Count > 10)
                {
                    // Simple opposing structure detection (last 5 bars)
                    bool opposingStructure = false;
                    int lookback = Math.Min(5, bars.Count - 2);

                    for (int i = bars.Count - 2; i >= bars.Count - 2 - lookback && i >= 1; i--)
                    {
                        double close = bars.ClosePrices[i];
                        double prevHigh = bars.HighPrices[i - 1];
                        double prevLow = bars.LowPrices[i - 1];

                        // Detect opposing MSS (simple version)
                        if (isBuy && close < prevLow)  // Bearish break while in buy position
                            opposingStructure = true;
                        else if (!isBuy && close > prevHigh)  // Bullish break while in sell position
                            opposingStructure = true;
                    }

                    if (opposingStructure && currentRR > 0)  // Only if in profit
                    {
                        // Tighten SL to lock in profits (aggressive exit)
                        double lockInSL = isBuy
                            ? entry + (currentFavorablePips * 0.5 * pip)  // Lock in 50% of current profit
                            : entry - (currentFavorablePips * 0.5 * pip);

                        if (ShouldImproveSL(p, lockInSL, isBuy))
                        {
                            if (_config.EnableDebugLogging)
                                _robot.Print($"[STRUCTURE EXIT] Opposing MSS detected! Tightening SL to lock 50% profit (RR={currentRR:F2})");

                            ModifyPositionCompat(p, lockInSL, p.TakeProfit);
                        }
                    }
                    else if (opposingStructure && currentRR <= 0)  // In loss - close immediately
                    {
                        if (_config.EnableDebugLogging)
                            _robot.Print($"[STRUCTURE EXIT] Opposing MSS + Loss (RR={currentRR:F2}) → Closing position to cut losses");

                        _robot.ClosePosition(p);
                        continue;  // Skip further processing for this position
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // ADVANCED FEATURE: PRICE ACTION MOMENTUM EXIT
                // ═══════════════════════════════════════════════════════════════
                // Analyze recent price action quality and adjust stops based on momentum
                if (_priceActionAnalyzer != null && bars != null && bars.Count > 5 && currentRR > 0)
                {
                    BiasDirection expectedDirection = isBuy ? BiasDirection.Bullish : BiasDirection.Bearish;
                    var recentMomentum = _priceActionAnalyzer.AnalyzeRecentMomentum(expectedDirection, 5);

                    if (_config.EnableDebugLogging)
                    {
                        _robot.Print($"[PA EXIT] Position {p.Id} | Recent Momentum: {recentMomentum.Quality} | Score: {recentMomentum.StrengthScore:F2} | RR: {currentRR:F2}");
                    }

                    // SCENARIO 1: Strong opposing impulse detected - Exit aggressively
                    if (recentMomentum.Quality == PriceActionAnalyzer.MoveQuality.Impulsive &&
                        recentMomentum.Direction != expectedDirection)
                    {
                        // Strong move AGAINST our position - tighten stop aggressively
                        double aggressiveSL = isBuy
                            ? current - (10 * pip)  // 10 pip buffer
                            : current + (10 * pip);

                        if (ShouldImproveSL(p, aggressiveSL, isBuy))
                        {
                            if (_config.EnableDebugLogging)
                                _robot.Print($"[PA EXIT] 🔴 OPPOSING IMPULSE detected! Tightening SL aggressively (10 pip buffer from current price)");

                            ModifyPositionCompat(p, aggressiveSL, p.TakeProfit);
                        }
                    }
                    // SCENARIO 2: Price becoming choppy/corrective - Tighten stops moderately
                    else if ((recentMomentum.Quality == PriceActionAnalyzer.MoveQuality.Corrective ||
                             recentMomentum.Quality == PriceActionAnalyzer.MoveQuality.WeakCorrective) &&
                            currentRR >= 1.0)  // Only if 1R+ profit
                    {
                        // Price stalling/choppy after good profit - lock in gains
                        double conservativeSL = isBuy
                            ? entry + (currentFavorablePips * 0.6 * pip)  // Lock in 60% of profit
                            : entry - (currentFavorablePips * 0.6 * pip);

                        if (ShouldImproveSL(p, conservativeSL, isBuy))
                        {
                            if (_config.EnableDebugLogging)
                                _robot.Print($"[PA EXIT] ⚠️ CHOPPY price action (RR={currentRR:F2}) → Tightening SL to lock 60% profit");

                            ModifyPositionCompat(p, conservativeSL, p.TakeProfit);
                        }
                    }
                    // SCENARIO 3: Momentum exhaustion after big run
                    else if (recentMomentum.Momentum == PriceActionAnalyzer.MomentumState.Exhausted &&
                            currentRR >= 2.0)  // Only if 2R+ profit
                    {
                        // Momentum exhausted after good run - take profits
                        if (_config.EnableDebugLogging)
                            _robot.Print($"[PA EXIT] 💤 MOMENTUM EXHAUSTED (RR={currentRR:F2}) → Closing position to bank profits");

                        _robot.ClosePosition(p);
                        continue;  // Skip further processing
                    }
                    // SCENARIO 4: Strong momentum in our direction - Let it run (widen trail)
                    else if (recentMomentum.Quality == PriceActionAnalyzer.MoveQuality.Impulsive &&
                            recentMomentum.Momentum == PriceActionAnalyzer.MomentumState.Accelerating &&
                            recentMomentum.Direction == expectedDirection &&
                            currentRR >= 1.0)
                    {
                        // Strong momentum WITH position - widen the trail to let it run
                        double wideSL = isBuy
                            ? entry + (currentFavorablePips * 0.4 * pip)  // Wider trail (40% of profit)
                            : entry - (currentFavorablePips * 0.4 * pip);

                        if (ShouldImproveSL(p, wideSL, isBuy))
                        {
                            if (_config.EnableDebugLogging)
                                _robot.Print($"[PA EXIT] ✅ STRONG MOMENTUM with position (RR={currentRR:F2}) → Wider trail to let it run");

                            ModifyPositionCompat(p, wideSL, p.TakeProfit);
                        }
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // ADVANCED FEATURE: NUANCED EXIT LOGIC
                // ═══════════════════════════════════════════════════════════════

                // 1. MOMENTUM-BASED EXIT: RSI Divergence Detection
                if (_rsi != null && _rsi.Result.Count > 20)
                {
                    double currentRSI = _rsi.Result.Last(0);
                    double prevRSI = _rsi.Result.Last(1);
                    double prev2RSI = _rsi.Result.Last(2);

                    // Detect RSI divergence (price makes new high/low, RSI doesn't)
                    bool rsiDivergence = false;

                    if (isBuy && currentRR > 0.5)
                    {
                        // Bullish position: Look for bearish RSI divergence
                        // Price higher but RSI lower = momentum exhaustion
                        bool priceHigher = current > bars.ClosePrices.Last(5);
                        bool rsiLower = currentRSI < prev2RSI && prevRSI < prev2RSI;

                        if (priceHigher && rsiLower && currentRSI > 70)
                            rsiDivergence = true;
                    }
                    else if (!isBuy && currentRR > 0.5)
                    {
                        // Bearish position: Look for bullish RSI divergence
                        // Price lower but RSI higher = momentum exhaustion
                        bool priceLower = current < bars.ClosePrices.Last(5);
                        bool rsiHigher = currentRSI > prev2RSI && prevRSI > prev2RSI;

                        if (priceLower && rsiHigher && currentRSI < 30)
                            rsiDivergence = true;
                    }

                    if (rsiDivergence)
                    {
                        // Tighten SL to lock 75% of current profit
                        double lockSL = isBuy
                            ? entry + (currentFavorablePips * 0.75 * pip)
                            : entry - (currentFavorablePips * 0.75 * pip);

                        if (ShouldImproveSL(p, lockSL, isBuy))
                        {
                            if (_config.EnableDebugLogging)
                                _robot.Print($"[MOMENTUM EXIT] RSI divergence detected! RSI={currentRSI:F1} | Locking 75% profit (RR={currentRR:F2})");

                            ModifyPositionCompat(p, lockSL, p.TakeProfit);
                        }
                    }
                }

                // 2. FAILURE SWING EXIT: Inability to make new high/low
                if (bars != null && bars.Count > 15 && currentRR > 0)
                {
                    int lookbackPeriod = Math.Min(10, bars.Count - 2);
                    bool failureSwing = false;

                    if (isBuy)
                    {
                        // Check if price failed to make new high 3 times in last 10 bars
                        double recentHigh = bars.HighPrices.Last(1);
                        for (int i = 2; i <= lookbackPeriod; i++)
                        {
                            if (bars.HighPrices.Last(i) > recentHigh)
                                recentHigh = bars.HighPrices.Last(i);
                        }

                        // If current price is >2 ATR below recent high = failure
                        double atrPips = (_atr != null && _atr.Result.Count > 0)
                            ? _atr.Result.LastValue / Symbol.PipSize : 10.0;

                        if (current < recentHigh - (2 * atrPips * pip))
                            failureSwing = true;
                    }
                    else
                    {
                        // Check if price failed to make new low 3 times in last 10 bars
                        double recentLow = bars.LowPrices.Last(1);
                        for (int i = 2; i <= lookbackPeriod; i++)
                        {
                            if (bars.LowPrices.Last(i) < recentLow)
                                recentLow = bars.LowPrices.Last(i);
                        }

                        // If current price is >2 ATR above recent low = failure
                        double atrPips = (_atr != null && _atr.Result.Count > 0)
                            ? _atr.Result.LastValue / Symbol.PipSize : 10.0;

                        if (current > recentLow + (2 * atrPips * pip))
                            failureSwing = true;
                    }

                    if (failureSwing && currentRR > 0.3)
                    {
                        // Tighten SL to lock 60% of current profit
                        double lockSL = isBuy
                            ? entry + (currentFavorablePips * 0.6 * pip)
                            : entry - (currentFavorablePips * 0.6 * pip);

                        if (ShouldImproveSL(p, lockSL, isBuy))
                        {
                            if (_config.EnableDebugLogging)
                                _robot.Print($"[FAILURE SWING EXIT] Failed to make new high/low | Locking 60% profit (RR={currentRR:F2})");

                            ModifyPositionCompat(p, lockSL, p.TakeProfit);
                        }
                    }
                }

                // 3. TIME-BASED EXIT: If trade open >4 hours and RR<0.5, consider exit
                if (_positionOpenTimes.ContainsKey(p.Id))
                {
                    DateTime openTime = _positionOpenTimes[p.Id];
                    TimeSpan timeInTrade = _robot.Server.Time - openTime;

                    // If trade has been open for more than 4 hours
                    if (timeInTrade.TotalHours > 4)
                    {
                        // If RR is still low after 4 hours, exit early
                        if (currentRR < 0.5 && currentRR > -0.3)
                        {
                            if (_config.EnableDebugLogging)
                                _robot.Print($"[TIME EXIT] Trade open {timeInTrade.TotalHours:F1}h with RR={currentRR:F2} → Closing to free capital");

                            _robot.ClosePosition(p);
                            _positionOpenTimes.Remove(p.Id); // Clean up
                            continue;
                        }
                        // If in small profit after 4 hours, tighten SL to breakeven
                        else if (currentRR >= 0.5 && currentRR < 1.0)
                        {
                            if (ShouldImproveSL(p, entry, isBuy))
                            {
                                if (_config.EnableDebugLogging)
                                    _robot.Print($"[TIME EXIT] Trade open {timeInTrade.TotalHours:F1}h with RR={currentRR:F2} → Moving SL to breakeven");

                                ModifyPositionCompat(p, entry, p.TakeProfit);
                            }
                        }
                    }
                }

                // --- Trailing stop (fixed pips) ---
                if (_config.EnableTrailingStop)
                {
                    bool startRR   = _config.TrailStartRR   > 0 && currentRR >= _config.TrailStartRR;
                    bool startPips = _config.TrailStartPips > 0 && currentFavorablePips >= _config.TrailStartPips;

                    if (startRR || startPips)
                    {
                        double trailDist = Math.Max(1.0, _config.TrailDistancePips) * pip;
                        double newSL = isBuy ? (current - trailDist) : (current + trailDist);

                        if (ShouldImproveSL(p, newSL, isBuy))
                        {
                            ModifyPositionCompat(p, newSL, p.TakeProfit);
                        }
                    }
                }
            }
        }

        private TradeResult ModifyPositionCompat(Position p, double? newStopLossPrice, double? newTakeProfitPrice)
        {
            // Use the legacy overload and suppress the obsolete warning.
            // This avoids the ProtectionType parameter that caused your compile error.
#pragma warning disable 618
            return _robot.ModifyPosition(p, newStopLossPrice, newTakeProfitPrice);
#pragma warning restore 618
        }

        private static bool ShouldImproveSL(Position p, double proposedSL, bool isBuy)
        {
            if (!p.StopLoss.HasValue) return true;
            double sl = p.StopLoss.Value;
            return isBuy ? (proposedSL > sl) : (proposedSL < sl);
        }

        private static double GuessInitRiskPips(Position p, Symbol symbol)
        {
            if (p.StopLoss.HasValue)
                return Math.Abs(p.EntryPrice - p.StopLoss.Value) / symbol.PipSize;
            return 20.0;
        }
    }

    public static class MarketDataExtensions
    {
        public class OppositeLiquidityLevel
        {
            public double Price { get; set; }
        }

        public class WeeklyHighLow
        {
            // TargetPrice is used by consumers to pick a TP; keep it simple here.
            public double TargetPrice { get; set; }
        }

        public class InternalBoundary
        {
            // Price represents the boundary price that a caller might use as a TP/SL reference.
            public double Price { get; set; }
        }

        public static OppositeLiquidityLevel GetOppositeLiquidityLevels(this MarketData md, bool isBuy)
        {
            // No underlying implementation available in this environment;
            // returning null allows the caller to fall back to other TP selection logic.
            return null;
        }

        public static WeeklyHighLow GetWeeklyHighLow(this MarketData md, bool isBuy)
        {
            // No underlying implementation available in this environment;
            // returning null allows the caller to fall back to other TP selection logic.
            return null;
        }

        public static InternalBoundary GetNearestInternalBoundary(this MarketData md, bool isBuy)
        {
            // Placeholder implementation: no market-internal boundary logic available here.
            // Returning null lets callers continue to other fallback TP selection paths.
            return null;
        }
    }
}
