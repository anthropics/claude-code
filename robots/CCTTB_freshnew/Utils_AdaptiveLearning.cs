using System;
using System.Collections.Generic;
using System.Linq;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using cAlgo.API;

namespace CCTTB
{
    /// <summary>
    /// Adaptive Learning System - Daily pattern tracking and decision optimization
    /// Tracks OTE placement accuracy, MSS swing quality, liquidity sweep reliability
    /// Continuously improves entry decisions based on accumulated historical data
    /// </summary>
    public class AdaptiveLearningEngine
    {
        private readonly Robot _robot;
        private readonly string _dataDirectory;
        private DailyLearningData _currentDay;
        private HistoricalPerformance _history;
        private DateTime _lastSaveDate;

        public AdaptiveLearningEngine(Robot robot, string dataDirectory)
        {
            _robot = robot;
            _dataDirectory = dataDirectory;
            _lastSaveDate = DateTime.MinValue;

            // Ensure directory exists
            if (!Directory.Exists(_dataDirectory))
                Directory.CreateDirectory(_dataDirectory);

            // Load historical performance database
            LoadHistory();

            // Initialize current day
            _currentDay = new DailyLearningData
            {
                Date = DateTime.UtcNow.Date,
                OtePatterns = new List<OtePatternRecord>(),
                MssPatterns = new List<MssPatternRecord>(),
                SweepPatterns = new List<SweepPatternRecord>(),
                EntryDecisions = new List<EntryDecisionRecord>(),
                SwingQualities = new List<SwingQualityRecord>()  // NEW: Initialize swing learning
            };
        }

        #region Data Structures

        public class DailyLearningData
        {
            public DateTime Date { get; set; }
            public List<OtePatternRecord> OtePatterns { get; set; }
            public List<MssPatternRecord> MssPatterns { get; set; }
            public List<SweepPatternRecord> SweepPatterns { get; set; }
            public List<EntryDecisionRecord> EntryDecisions { get; set; }
            public List<SwingQualityRecord> SwingQualities { get; set; }  // NEW: Track swing quality
        }

        public class OtePatternRecord
        {
            public DateTime Timestamp { get; set; }
            public double FibLevel { get; set; }           // 0.618, 0.705, 0.786
            public double ZoneTop { get; set; }
            public double ZoneBottom { get; set; }
            public double TapPrice { get; set; }
            public double BufferPips { get; set; }
            public bool WasTapped { get; set; }
            public bool EntryExecuted { get; set; }
            public string Outcome { get; set; }            // "Win", "Loss", "Pending", "NoEntry"
            public double? FinalRR { get; set; }
            public double ConfidenceScore { get; set; }    // Based on historical success
        }

        public class MssPatternRecord
        {
            public DateTime Timestamp { get; set; }
            public string Direction { get; set; }          // "Bullish", "Bearish"
            public double BreakPrice { get; set; }
            public double DisplacementPips { get; set; }
            public double DisplacementATR { get; set; }
            public bool BodyClose { get; set; }
            public bool FollowThrough { get; set; }        // Did price continue in MSS direction?
            public double FollowThroughPips { get; set; }
            public double QualityScore { get; set; }       // Based on historical follow-through
        }

        public class SweepPatternRecord
        {
            public DateTime Timestamp { get; set; }
            public string Type { get; set; }               // "PDH", "PDL", "EQH", "EQL", "Weekly"
            public double SweepPrice { get; set; }
            public double ExcessPips { get; set; }         // How far beyond level
            public bool MssFollowed { get; set; }          // Did MSS occur after sweep?
            public int BarsUntilMss { get; set; }
            public double ReliabilityScore { get; set; }   // Based on MSS follow-through rate
        }

        public class EntryDecisionRecord
        {
            public DateTime Timestamp { get; set; }
            public string Direction { get; set; }
            public string EntryType { get; set; }          // "OTE", "OB", "FVG", "BB"
            public double EntryPrice { get; set; }
            public double StopLoss { get; set; }
            public double TakeProfit { get; set; }
            public double RRRatio { get; set; }
            public string Outcome { get; set; }            // "Win", "Loss", "Pending"
            public double PnL { get; set; }
            public double DurationHours { get; set; }
            public string SweepType { get; set; }
            public double MssQuality { get; set; }
            public double OteAccuracy { get; set; }
            public double DecisionScore { get; set; }      // Composite score
        }

        /// <summary>
        /// NEW: Tracks swing quality for OTE placement learning
        /// Learns which swing characteristics produce best results for buy vs sell
        /// </summary>
        public class SwingQualityRecord
        {
            public DateTime Timestamp { get; set; }
            public string Direction { get; set; }          // "Bullish" or "Bearish"
            public double SwingHigh { get; set; }
            public double SwingLow { get; set; }
            public double SwingRangePips { get; set; }
            public double SwingDurationBars { get; set; }
            public double SwingDisplacementATR { get; set; } // Momentum strength
            public string Session { get; set; }             // "London", "NY", "Asia"
            public bool UsedForOTE { get; set; }            // Was this swing used for OTE?
            public bool OTEWorked { get; set; }             // Did OTE entry succeed?
            public string OTEOutcome { get; set; }          // "Win", "Loss", "NoEntry", "N/A"
            public double SwingQualityScore { get; set; }   // Learned quality score

            // Swing characteristics that matter
            public double SwingBodyRatio { get; set; }      // Body size vs range
            public bool CleanSwing { get; set; }            // Few wicks, strong momentum
            public int SwingTouchCount { get; set; }        // How many times price touched extremes
            public double SwingAngle { get; set; }          // Steepness of swing
        }

        public class HistoricalPerformance
        {
            public DateTime LastUpdated { get; set; }
            public int TotalDays { get; set; }
            public OteHistoricalStats OteStats { get; set; }
            public MssHistoricalStats MssStats { get; set; }
            public SweepHistoricalStats SweepStats { get; set; }
            public SwingHistoricalStats SwingStats { get; set; }  // NEW: Swing quality learning
            public Dictionary<string, DecisionStats> DecisionStatsByType { get; set; }
        }

        public class OteHistoricalStats
        {
            public int TotalTaps { get; set; }
            public int SuccessfulEntries { get; set; }
            public double AverageSuccessRate { get; set; }
            public Dictionary<string, double> SuccessRateByFibLevel { get; set; }  // "0.618" -> 0.72
            public Dictionary<string, double> SuccessRateBySession { get; set; }   // "London" -> 0.78
            public double OptimalBufferPips { get; set; }
            public double ConfidenceThreshold { get; set; }
        }

        public class MssHistoricalStats
        {
            public int TotalMss { get; set; }
            public int FollowThroughCount { get; set; }
            public double AverageFollowThroughRate { get; set; }
            public Dictionary<string, double> QualityByDisplacement { get; set; }  // "0.20-0.25" -> 0.68
            public Dictionary<string, double> QualityBySession { get; set; }
            public double MinQualityThreshold { get; set; }
        }

        public class SweepHistoricalStats
        {
            public int TotalSweeps { get; set; }
            public int MssFollowCount { get; set; }
            public double AverageMssFollowRate { get; set; }
            public Dictionary<string, double> ReliabilityByType { get; set; }      // "PDH" -> 0.65
            public Dictionary<string, double> ReliabilityBySession { get; set; }
            public int AverageBarsUntilMss { get; set; }
        }

        /// <summary>
        /// NEW: Swing quality historical statistics for learning optimal swing selection
        /// </summary>
        public class SwingHistoricalStats
        {
            public int TotalSwings { get; set; }
            public int SwingsUsedForOTE { get; set; }
            public int SuccessfulOTEs { get; set; }
            public double AverageOTESuccessRate { get; set; }

            // Success rates by characteristics
            public Dictionary<string, double> SuccessRateBySwingSize { get; set; }        // "10-20 pips" -> 0.72
            public Dictionary<string, double> SuccessRateByDuration { get; set; }         // "5-10 bars" -> 0.68
            public Dictionary<string, double> SuccessRateByDisplacement { get; set; }     // "0.3-0.4 ATR" -> 0.75
            public Dictionary<string, double> SuccessRateBySession { get; set; }          // "London" -> 0.78
            public Dictionary<string, double> SuccessRateByDirection { get; set; }        // "Bullish" -> 0.70

            // Optimal characteristics learned
            public double OptimalSwingRangePips { get; set; }
            public double OptimalSwingDuration { get; set; }
            public double OptimalSwingDisplacement { get; set; }
            public double MinSwingQualityThreshold { get; set; }
        }

        public class DecisionStats
        {
            public int TotalTrades { get; set; }
            public int Wins { get; set; }
            public int Losses { get; set; }
            public double WinRate { get; set; }
            public double AverageRR { get; set; }
            public double AveragePnL { get; set; }
            public double Confidence { get; set; }         // Evolving confidence score
        }

        #endregion

        #region Core Learning Methods

        /// <summary>
        /// Record an OTE zone tap for learning
        /// </summary>
        public void RecordOteTap(double fibLevel, double zoneTop, double zoneBottom,
                                 double tapPrice, double bufferPips, bool entryExecuted)
        {
            var record = new OtePatternRecord
            {
                Timestamp = DateTime.UtcNow,
                FibLevel = fibLevel,
                ZoneTop = zoneTop,
                ZoneBottom = zoneBottom,
                TapPrice = tapPrice,
                BufferPips = bufferPips,
                WasTapped = true,
                EntryExecuted = entryExecuted,
                Outcome = "Pending",
                ConfidenceScore = CalculateOteConfidence(fibLevel, bufferPips)
            };

            _currentDay.OtePatterns.Add(record);
        }

        /// <summary>
        /// Record an MSS detection for learning
        /// </summary>
        public void RecordMssDetection(string direction, double breakPrice,
                                       double displacementPips, double displacementATR,
                                       bool bodyClose)
        {
            var record = new MssPatternRecord
            {
                Timestamp = DateTime.UtcNow,
                Direction = direction,
                BreakPrice = breakPrice,
                DisplacementPips = displacementPips,
                DisplacementATR = displacementATR,
                BodyClose = bodyClose,
                FollowThrough = false,  // Will be updated later
                QualityScore = CalculateMssQuality(displacementATR, bodyClose)
            };

            _currentDay.MssPatterns.Add(record);
        }

        /// <summary>
        /// Record a liquidity sweep for learning
        /// </summary>
        public void RecordLiquiditySweep(string type, double sweepPrice, double excessPips)
        {
            var record = new SweepPatternRecord
            {
                Timestamp = DateTime.UtcNow,
                Type = type,
                SweepPrice = sweepPrice,
                ExcessPips = excessPips,
                MssFollowed = false,  // Will be updated when MSS detected
                BarsUntilMss = 0,
                ReliabilityScore = CalculateSweepReliability(type, excessPips)
            };

            _currentDay.SweepPatterns.Add(record);
        }

        /// <summary>
        /// Record an entry decision for learning
        /// </summary>
        public void RecordEntryDecision(string direction, string entryType, double entryPrice,
                                       double stopLoss, double takeProfit, string sweepType,
                                       double mssQuality, double oteAccuracy)
        {
            var rrRatio = Math.Abs(takeProfit - entryPrice) / Math.Abs(stopLoss - entryPrice);

            var record = new EntryDecisionRecord
            {
                Timestamp = DateTime.UtcNow,
                Direction = direction,
                EntryType = entryType,
                EntryPrice = entryPrice,
                StopLoss = stopLoss,
                TakeProfit = takeProfit,
                RRRatio = rrRatio,
                Outcome = "Pending",
                SweepType = sweepType,
                MssQuality = mssQuality,
                OteAccuracy = oteAccuracy,
                DecisionScore = CalculateDecisionScore(mssQuality, oteAccuracy, rrRatio)
            };

            _currentDay.EntryDecisions.Add(record);
        }

        /// <summary>
        /// Update entry outcome when trade closes
        /// </summary>
        public void UpdateEntryOutcome(double entryPrice, string outcome, double pnl, double durationHours)
        {
            var entry = _currentDay.EntryDecisions
                .Where(e => Math.Abs(e.EntryPrice - entryPrice) < 0.0001 && e.Outcome == "Pending")
                .OrderByDescending(e => e.Timestamp)
                .FirstOrDefault();

            if (entry != null)
            {
                entry.Outcome = outcome;
                entry.PnL = pnl;
                entry.DurationHours = durationHours;

                // Update related OTE pattern outcome
                UpdateOteOutcome(entryPrice, outcome, entry.RRRatio);
            }
        }

        /// <summary>
        /// Update MSS follow-through status
        /// </summary>
        public void UpdateMssFollowThrough(double breakPrice, bool followedThrough, double followThroughPips)
        {
            var mss = _currentDay.MssPatterns
                .Where(m => Math.Abs(m.BreakPrice - breakPrice) < 0.0001)
                .OrderByDescending(m => m.Timestamp)
                .FirstOrDefault();

            if (mss != null)
            {
                mss.FollowThrough = followedThrough;
                mss.FollowThroughPips = followThroughPips;
            }
        }

        /// <summary>
        /// Update sweep MSS follow status
        /// </summary>
        public void UpdateSweepMssFollow(string sweepType, double sweepPrice, int barsUntilMss)
        {
            var sweep = _currentDay.SweepPatterns
                .Where(s => s.Type == sweepType && Math.Abs(s.SweepPrice - sweepPrice) < 0.0001)
                .OrderByDescending(s => s.Timestamp)
                .FirstOrDefault();

            if (sweep != null)
            {
                sweep.MssFollowed = true;
                sweep.BarsUntilMss = barsUntilMss;
            }
        }

        /// <summary>
        /// NEW: Record a swing for quality learning
        /// </summary>
        public void RecordSwing(string direction, double swingHigh, double swingLow,
                               double swingRangePips, double swingDurationBars,
                               double swingDisplacementATR, string session,
                               double bodyRatio, bool cleanSwing, int touchCount, double angle)
        {
            if (_currentDay.SwingQualities == null)
                _currentDay.SwingQualities = new List<SwingQualityRecord>();

            var record = new SwingQualityRecord
            {
                Timestamp = DateTime.UtcNow,
                Direction = direction,
                SwingHigh = swingHigh,
                SwingLow = swingLow,
                SwingRangePips = swingRangePips,
                SwingDurationBars = swingDurationBars,
                SwingDisplacementATR = swingDisplacementATR,
                Session = session,
                UsedForOTE = false,  // Will be updated when OTE zone is set
                OTEWorked = false,   // Will be updated on trade outcome
                OTEOutcome = "N/A",
                SwingQualityScore = CalculateSwingQuality(direction, swingRangePips, swingDurationBars,
                                                         swingDisplacementATR, session),
                SwingBodyRatio = bodyRatio,
                CleanSwing = cleanSwing,
                SwingTouchCount = touchCount,
                SwingAngle = angle
            };

            _currentDay.SwingQualities.Add(record);
        }

        /// <summary>
        /// NEW: Mark most recent swing as used for OTE zone
        /// </summary>
        public void UpdateSwingOTEUsage(string direction, double swingHigh, double swingLow)
        {
            if (_currentDay.SwingQualities == null || !_currentDay.SwingQualities.Any())
                return;

            var swing = _currentDay.SwingQualities
                .Where(s => s.Direction == direction &&
                           Math.Abs(s.SwingHigh - swingHigh) < 0.0001 &&
                           Math.Abs(s.SwingLow - swingLow) < 0.0001 &&
                           !s.UsedForOTE)
                .OrderByDescending(s => s.Timestamp)
                .FirstOrDefault();

            if (swing != null)
            {
                swing.UsedForOTE = true;
            }
        }

        /// <summary>
        /// NEW: Update swing OTE outcome when trade completes
        /// </summary>
        public void UpdateSwingOTEOutcome(string direction, double swingHigh, double swingLow,
                                         bool oteWorked, string outcome)
        {
            if (_currentDay.SwingQualities == null || !_currentDay.SwingQualities.Any())
                return;

            var swing = _currentDay.SwingQualities
                .Where(s => s.Direction == direction &&
                           Math.Abs(s.SwingHigh - swingHigh) < 0.0001 &&
                           Math.Abs(s.SwingLow - swingLow) < 0.0001 &&
                           s.UsedForOTE)
                .OrderByDescending(s => s.Timestamp)
                .FirstOrDefault();

            if (swing != null)
            {
                swing.OTEWorked = oteWorked;
                swing.OTEOutcome = outcome;
            }
        }

        #endregion

        #region Scoring Methods

        /// <summary>
        /// Calculate OTE confidence score based on historical success
        /// </summary>
        public double CalculateOteConfidence(double fibLevel, double bufferPips)
        {
            if (_history?.OteStats == null)
                return 0.5;  // Neutral confidence

            // Base success rate
            double baseConfidence = _history.OteStats.AverageSuccessRate;

            // Adjust by fib level success
            string fibKey = fibLevel.ToString("F3");
            if (_history.OteStats.SuccessRateByFibLevel.ContainsKey(fibKey))
            {
                double fibSuccess = _history.OteStats.SuccessRateByFibLevel[fibKey];
                baseConfidence = (baseConfidence + fibSuccess) / 2.0;
            }

            // Adjust by buffer proximity to optimal
            double bufferDiff = Math.Abs(bufferPips - _history.OteStats.OptimalBufferPips);
            double bufferPenalty = Math.Min(bufferDiff * 0.05, 0.2);  // Max 20% penalty

            return Math.Max(0.1, Math.Min(1.0, baseConfidence - bufferPenalty));
        }

        /// <summary>
        /// Calculate MSS quality score based on historical follow-through
        /// </summary>
        public double CalculateMssQuality(double displacementATR, bool bodyClose)
        {
            if (_history?.MssStats == null)
                return 0.5;  // Neutral quality

            double baseQuality = _history.MssStats.AverageFollowThroughRate;

            // Adjust by displacement range
            string dispKey = GetDisplacementBucket(displacementATR);
            if (_history.MssStats.QualityByDisplacement.ContainsKey(dispKey))
            {
                double dispQuality = _history.MssStats.QualityByDisplacement[dispKey];
                baseQuality = (baseQuality + dispQuality) / 2.0;
            }

            // Bonus for body close
            if (bodyClose)
                baseQuality += 0.1;

            return Math.Max(0.1, Math.Min(1.0, baseQuality));
        }

        /// <summary>
        /// Calculate sweep reliability score based on historical MSS follow rate
        /// </summary>
        public double CalculateSweepReliability(string sweepType, double excessPips)
        {
            if (_history?.SweepStats == null)
                return 0.5;  // Neutral reliability

            double baseReliability = _history.SweepStats.AverageMssFollowRate;

            // Adjust by sweep type
            if (_history.SweepStats.ReliabilityByType.ContainsKey(sweepType))
            {
                double typeReliability = _history.SweepStats.ReliabilityByType[sweepType];
                baseReliability = (baseReliability + typeReliability) / 2.0;
            }

            // Bonus for deeper sweeps (more liquidity taken)
            if (excessPips > 3.0)
                baseReliability += 0.05;

            return Math.Max(0.1, Math.Min(1.0, baseReliability));
        }

        /// <summary>
        /// Calculate composite decision score for entry quality
        /// </summary>
        public double CalculateDecisionScore(double mssQuality, double oteAccuracy, double rrRatio)
        {
            // Weighted composite score
            double score = (mssQuality * 0.4) + (oteAccuracy * 0.3) + (Math.Min(rrRatio / 3.0, 1.0) * 0.3);
            return Math.Max(0.1, Math.Min(1.0, score));
        }

        /// <summary>
        /// NEW: Calculate swing quality score based on historical learning
        /// </summary>
        public double CalculateSwingQuality(string direction, double swingRangePips,
                                           double swingDurationBars, double swingDisplacementATR,
                                           string session)
        {
            if (_history?.SwingStats == null)
                return 0.5;  // Neutral quality - no data yet

            double baseQuality = 0.5;

            // Check swing size success rate
            string sizeKey = GetSwingSizeBucket(swingRangePips);
            if (_history.SwingStats.SuccessRateBySwingSize != null &&
                _history.SwingStats.SuccessRateBySwingSize.ContainsKey(sizeKey))
            {
                baseQuality += (_history.SwingStats.SuccessRateBySwingSize[sizeKey] - 0.5) * 0.25;
            }

            // Check duration success rate
            string durKey = GetSwingDurationBucket(swingDurationBars);
            if (_history.SwingStats.SuccessRateByDuration != null &&
                _history.SwingStats.SuccessRateByDuration.ContainsKey(durKey))
            {
                baseQuality += (_history.SwingStats.SuccessRateByDuration[durKey] - 0.5) * 0.25;
            }

            // Check displacement success rate
            string dispKey = GetSwingDisplacementBucket(swingDisplacementATR);
            if (_history.SwingStats.SuccessRateByDisplacement != null &&
                _history.SwingStats.SuccessRateByDisplacement.ContainsKey(dispKey))
            {
                baseQuality += (_history.SwingStats.SuccessRateByDisplacement[dispKey] - 0.5) * 0.25;
            }

            // Check session success rate
            if (_history.SwingStats.SuccessRateBySession != null &&
                _history.SwingStats.SuccessRateBySession.ContainsKey(session))
            {
                baseQuality += (_history.SwingStats.SuccessRateBySession[session] - 0.5) * 0.15;
            }

            // Check direction success rate
            if (_history.SwingStats.SuccessRateByDirection != null &&
                _history.SwingStats.SuccessRateByDirection.ContainsKey(direction))
            {
                baseQuality += (_history.SwingStats.SuccessRateByDirection[direction] - 0.5) * 0.10;
            }

            // Clamp to 0.1-1.0 range
            return Math.Max(0.1, Math.Min(1.0, baseQuality));
        }

        /// <summary>
        /// Get adaptive MinRR threshold based on learning
        /// </summary>
        public double GetAdaptiveMinRR(string entryType)
        {
            if (_history?.DecisionStatsByType == null || !_history.DecisionStatsByType.ContainsKey(entryType))
                return 1.60;  // Default

            var stats = _history.DecisionStatsByType[entryType];

            // If win rate is high, can lower RR slightly for more opportunities
            if (stats.WinRate > 0.70)
                return 1.50;

            // If win rate is low, raise RR for better quality
            if (stats.WinRate < 0.55)
                return 1.80;

            return 1.60;  // Balanced
        }

        /// <summary>
        /// Get adaptive OTE buffer based on learning
        /// </summary>
        public double GetAdaptiveOteBuffer()
        {
            if (_history?.OteStats == null)
                return 0.5;  // Default

            return _history.OteStats.OptimalBufferPips;
        }

        /// <summary>
        /// Get historical win rate for a specific pattern type and preset name
        /// Used by Unified Confidence Score to query the bot's "memory"
        /// Example: GetHistoricalWinRate("Bullish OTE", "NY_Strict_Triple") → 0.68 (68% win rate)
        /// </summary>
        public double GetHistoricalWinRate(string patternType, string presetName)
        {
            try
            {
                if (_history?.DecisionStatsByType == null)
                    return 0.5;  // No history yet - neutral confidence

                // PRIORITY 1: Check preset-specific stats
                // This allows the bot to "remember" that "Bullish OTE" works well under "NY_Strict_Triple"
                // but poorly under "Asia_Internal_Mechanical"
                string presetKey = $"{presetName}_{patternType}";  // e.g., "NY_Strict_Triple_Bullish OTE"
                if (_history.DecisionStatsByType.TryGetValue(presetKey, out var presetStats) && presetStats.TotalTrades > 10)
                {
                    _robot.Print($"[AdaptiveLearning] Historical WinRate: {presetKey} = {presetStats.WinRate:F2} ({presetStats.TotalTrades} trades)");
                    return presetStats.WinRate;  // e.g., 0.68 (68% win rate)
                }

                // PRIORITY 2: Check general pattern stats (all presets combined)
                // Fallback when not enough data for specific preset
                if (_history.DecisionStatsByType.TryGetValue(patternType, out var generalStats) && generalStats.TotalTrades > 10)
                {
                    _robot.Print($"[AdaptiveLearning] Historical WinRate (general): {patternType} = {generalStats.WinRate:F2} ({generalStats.TotalTrades} trades)");
                    return generalStats.WinRate;  // e.g., 0.62 (62% win rate across all presets)
                }

                // Not enough data yet - return neutral
                _robot.Print($"[AdaptiveLearning] No sufficient historical data for '{patternType}' (preset: {presetName}) - returning neutral 0.5");
                return 0.5;  // 50% neutral confidence (bot is still learning)
            }
            catch (Exception ex)
            {
                _robot.Print($"[AdaptiveLearning] ERROR in GetHistoricalWinRate: {ex.Message}");
                return 0.5;  // Fail-safe: return neutral on error
            }
        }

        /// <summary>
        /// Get adaptive MSS displacement threshold based on learning
        /// </summary>
        public double GetAdaptiveMssDisplacement()
        {
            if (_history?.MssStats == null)
                return 0.20;  // Default

            return _history.MssStats.MinQualityThreshold;
        }

        #endregion

        #region Persistence Methods

        /// <summary>
        /// Save current day's data at end of trading session
        /// </summary>
        public void SaveDailyData()
        {
            try
            {
                var today = DateTime.UtcNow.Date;

                // Only save once per day
                if (_lastSaveDate == today)
                    return;

                string filename = Path.Combine(_dataDirectory, $"daily_{today:yyyyMMdd}.json");

                var options = new JsonSerializerOptions
                {
                    WriteIndented = true,
                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                };

                string json = JsonSerializer.Serialize(_currentDay, options);
                File.WriteAllText(filename, json);

                _lastSaveDate = today;

                // Update historical performance
                UpdateHistoricalPerformance();
                SaveHistory();

                _robot.Print($"[AdaptiveLearning] Daily data saved: {filename}");
            }
            catch (Exception ex)
            {
                _robot.Print($"[AdaptiveLearning] ERROR saving daily data: {ex.Message}");
            }
        }

        /// <summary>
        /// Load historical performance database
        /// </summary>
        private void LoadHistory()
        {
            try
            {
                string filename = Path.Combine(_dataDirectory, "history.json");

                if (File.Exists(filename))
                {
                    string json = File.ReadAllText(filename);
                    _history = JsonSerializer.Deserialize<HistoricalPerformance>(json);
                    _robot.Print($"[AdaptiveLearning] Loaded history: {_history.TotalDays} days");
                }
                else
                {
                    // Initialize new history
                    _history = new HistoricalPerformance
                    {
                        LastUpdated = DateTime.UtcNow,
                        TotalDays = 0,
                        OteStats = new OteHistoricalStats
                        {
                            SuccessRateByFibLevel = new Dictionary<string, double>(),
                            SuccessRateBySession = new Dictionary<string, double>(),
                            OptimalBufferPips = 0.5,
                            ConfidenceThreshold = 0.6
                        },
                        MssStats = new MssHistoricalStats
                        {
                            QualityByDisplacement = new Dictionary<string, double>(),
                            QualityBySession = new Dictionary<string, double>(),
                            MinQualityThreshold = 0.20
                        },
                        SweepStats = new SweepHistoricalStats
                        {
                            ReliabilityByType = new Dictionary<string, double>(),
                            ReliabilityBySession = new Dictionary<string, double>(),
                            AverageBarsUntilMss = 20
                        },
                        DecisionStatsByType = new Dictionary<string, DecisionStats>()
                    };
                }
            }
            catch (Exception ex)
            {
                _robot.Print($"[AdaptiveLearning] ERROR loading history: {ex.Message}");
            }
        }

        /// <summary>
        /// Save historical performance database
        /// </summary>
        private void SaveHistory()
        {
            try
            {
                string filename = Path.Combine(_dataDirectory, "history.json");

                var options = new JsonSerializerOptions
                {
                    WriteIndented = true,
                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                };

                string json = JsonSerializer.Serialize(_history, options);
                File.WriteAllText(filename, json);
            }
            catch (Exception ex)
            {
                _robot.Print($"[AdaptiveLearning] ERROR saving history: {ex.Message}");
            }
        }

        /// <summary>
        /// Update historical performance from current day's data
        /// </summary>
        private void UpdateHistoricalPerformance()
        {
            _history.TotalDays++;
            _history.LastUpdated = DateTime.UtcNow;

            // Update OTE stats
            UpdateOteHistoricalStats();

            // Update MSS stats
            UpdateMssHistoricalStats();

            // Update Sweep stats
            UpdateSweepHistoricalStats();

            // Update Decision stats
            UpdateDecisionHistoricalStats();

            // Update Swing stats (NEW)
            UpdateSwingHistoricalStats();
        }

        private void UpdateOteHistoricalStats()
        {
            var successfulOtes = _currentDay.OtePatterns.Where(o => o.Outcome == "Win").ToList();
            var totalOtes = _currentDay.OtePatterns.Where(o => o.EntryExecuted).ToList();

            if (totalOtes.Any())
            {
                // Update global stats
                _history.OteStats.TotalTaps += totalOtes.Count;
                _history.OteStats.SuccessfulEntries += successfulOtes.Count;
                _history.OteStats.AverageSuccessRate =
                    (double)_history.OteStats.SuccessfulEntries / _history.OteStats.TotalTaps;

                // Update by fib level
                foreach (var fibGroup in totalOtes.GroupBy(o => o.FibLevel.ToString("F3")))
                {
                    string key = fibGroup.Key;
                    int wins = fibGroup.Count(o => o.Outcome == "Win");
                    double winRate = (double)wins / fibGroup.Count();

                    if (_history.OteStats.SuccessRateByFibLevel.ContainsKey(key))
                    {
                        // Exponential moving average
                        double oldRate = _history.OteStats.SuccessRateByFibLevel[key];
                        _history.OteStats.SuccessRateByFibLevel[key] = oldRate * 0.7 + winRate * 0.3;
                    }
                    else
                    {
                        _history.OteStats.SuccessRateByFibLevel[key] = winRate;
                    }
                }

                // Update optimal buffer (favor winning trades' buffers)
                if (successfulOtes.Any())
                {
                    double avgWinningBuffer = successfulOtes.Average(o => o.BufferPips);
                    _history.OteStats.OptimalBufferPips =
                        _history.OteStats.OptimalBufferPips * 0.8 + avgWinningBuffer * 0.2;
                }
            }
        }

        private void UpdateMssHistoricalStats()
        {
            var followedMss = _currentDay.MssPatterns.Where(m => m.FollowThrough).ToList();
            var totalMss = _currentDay.MssPatterns.ToList();

            if (totalMss.Any())
            {
                _history.MssStats.TotalMss += totalMss.Count;
                _history.MssStats.FollowThroughCount += followedMss.Count;
                _history.MssStats.AverageFollowThroughRate =
                    (double)_history.MssStats.FollowThroughCount / _history.MssStats.TotalMss;

                // Update by displacement bucket
                foreach (var dispGroup in totalMss.GroupBy(m => GetDisplacementBucket(m.DisplacementATR)))
                {
                    string key = dispGroup.Key;
                    int followed = dispGroup.Count(m => m.FollowThrough);
                    double followRate = (double)followed / dispGroup.Count();

                    if (_history.MssStats.QualityByDisplacement.ContainsKey(key))
                    {
                        double oldRate = _history.MssStats.QualityByDisplacement[key];
                        _history.MssStats.QualityByDisplacement[key] = oldRate * 0.7 + followRate * 0.3;
                    }
                    else
                    {
                        _history.MssStats.QualityByDisplacement[key] = followRate;
                    }
                }
            }
        }

        private void UpdateSweepHistoricalStats()
        {
            var followedSweeps = _currentDay.SweepPatterns.Where(s => s.MssFollowed).ToList();
            var totalSweeps = _currentDay.SweepPatterns.ToList();

            if (totalSweeps.Any())
            {
                _history.SweepStats.TotalSweeps += totalSweeps.Count;
                _history.SweepStats.MssFollowCount += followedSweeps.Count;
                _history.SweepStats.AverageMssFollowRate =
                    (double)_history.SweepStats.MssFollowCount / _history.SweepStats.TotalSweeps;

                // Update by sweep type
                foreach (var typeGroup in totalSweeps.GroupBy(s => s.Type))
                {
                    string key = typeGroup.Key;
                    int followed = typeGroup.Count(s => s.MssFollowed);
                    double followRate = (double)followed / typeGroup.Count();

                    if (_history.SweepStats.ReliabilityByType.ContainsKey(key))
                    {
                        double oldRate = _history.SweepStats.ReliabilityByType[key];
                        _history.SweepStats.ReliabilityByType[key] = oldRate * 0.7 + followRate * 0.3;
                    }
                    else
                    {
                        _history.SweepStats.ReliabilityByType[key] = followRate;
                    }
                }

                // Update average bars until MSS
                if (followedSweeps.Any())
                {
                    int avgBars = (int)followedSweeps.Average(s => s.BarsUntilMss);
                    _history.SweepStats.AverageBarsUntilMss =
                        (_history.SweepStats.AverageBarsUntilMss + avgBars) / 2;
                }
            }
        }

        private void UpdateDecisionHistoricalStats()
        {
            var completedDecisions = _currentDay.EntryDecisions
                .Where(e => e.Outcome == "Win" || e.Outcome == "Loss")
                .ToList();

            foreach (var typeGroup in completedDecisions.GroupBy(e => e.EntryType))
            {
                string key = typeGroup.Key;

                if (!_history.DecisionStatsByType.ContainsKey(key))
                {
                    _history.DecisionStatsByType[key] = new DecisionStats();
                }

                var stats = _history.DecisionStatsByType[key];
                int wins = typeGroup.Count(e => e.Outcome == "Win");
                int losses = typeGroup.Count(e => e.Outcome == "Loss");

                stats.TotalTrades += typeGroup.Count();
                stats.Wins += wins;
                stats.Losses += losses;
                stats.WinRate = (double)stats.Wins / stats.TotalTrades;
                stats.AverageRR = (stats.AverageRR * (stats.TotalTrades - typeGroup.Count()) +
                                  typeGroup.Average(e => e.RRRatio) * typeGroup.Count()) / stats.TotalTrades;
                stats.AveragePnL = (stats.AveragePnL * (stats.TotalTrades - typeGroup.Count()) +
                                   typeGroup.Average(e => e.PnL) * typeGroup.Count()) / stats.TotalTrades;
                stats.Confidence = Math.Min(1.0, stats.WinRate + (stats.AverageRR - 1.5) * 0.1);
            }
        }

        /// <summary>
        /// NEW: Update swing quality historical statistics
        /// </summary>
        private void UpdateSwingHistoricalStats()
        {
            if (_currentDay.SwingQualities == null || !_currentDay.SwingQualities.Any())
                return;

            var swingsUsedForOTE = _currentDay.SwingQualities.Where(s => s.UsedForOTE).ToList();
            var successfulOTEs = swingsUsedForOTE.Where(s => s.OTEWorked).ToList();

            if (_history.SwingStats == null)
            {
                _history.SwingStats = new SwingHistoricalStats
                {
                    SuccessRateBySwingSize = new Dictionary<string, double>(),
                    SuccessRateByDuration = new Dictionary<string, double>(),
                    SuccessRateByDisplacement = new Dictionary<string, double>(),
                    SuccessRateBySession = new Dictionary<string, double>(),
                    SuccessRateByDirection = new Dictionary<string, double>()
                };
            }

            // Update global stats
            _history.SwingStats.TotalSwings += _currentDay.SwingQualities.Count;
            _history.SwingStats.SwingsUsedForOTE += swingsUsedForOTE.Count;
            _history.SwingStats.SuccessfulOTEs += successfulOTEs.Count;

            if (_history.SwingStats.SwingsUsedForOTE > 0)
            {
                _history.SwingStats.AverageOTESuccessRate =
                    (double)_history.SwingStats.SuccessfulOTEs / _history.SwingStats.SwingsUsedForOTE;
            }

            // Update by swing size
            foreach (var sizeGroup in swingsUsedForOTE.GroupBy(s => GetSwingSizeBucket(s.SwingRangePips)))
            {
                string key = sizeGroup.Key;
                int wins = sizeGroup.Count(s => s.OTEWorked);
                double winRate = (double)wins / sizeGroup.Count();

                if (_history.SwingStats.SuccessRateBySwingSize.ContainsKey(key))
                {
                    double oldRate = _history.SwingStats.SuccessRateBySwingSize[key];
                    _history.SwingStats.SuccessRateBySwingSize[key] = oldRate * 0.7 + winRate * 0.3;
                }
                else
                {
                    _history.SwingStats.SuccessRateBySwingSize[key] = winRate;
                }
            }

            // Update by duration
            foreach (var durGroup in swingsUsedForOTE.GroupBy(s => GetSwingDurationBucket(s.SwingDurationBars)))
            {
                string key = durGroup.Key;
                int wins = durGroup.Count(s => s.OTEWorked);
                double winRate = (double)wins / durGroup.Count();

                if (_history.SwingStats.SuccessRateByDuration.ContainsKey(key))
                {
                    double oldRate = _history.SwingStats.SuccessRateByDuration[key];
                    _history.SwingStats.SuccessRateByDuration[key] = oldRate * 0.7 + winRate * 0.3;
                }
                else
                {
                    _history.SwingStats.SuccessRateByDuration[key] = winRate;
                }
            }

            // Update by displacement
            foreach (var dispGroup in swingsUsedForOTE.GroupBy(s => GetSwingDisplacementBucket(s.SwingDisplacementATR)))
            {
                string key = dispGroup.Key;
                int wins = dispGroup.Count(s => s.OTEWorked);
                double winRate = (double)wins / dispGroup.Count();

                if (_history.SwingStats.SuccessRateByDisplacement.ContainsKey(key))
                {
                    double oldRate = _history.SwingStats.SuccessRateByDisplacement[key];
                    _history.SwingStats.SuccessRateByDisplacement[key] = oldRate * 0.7 + winRate * 0.3;
                }
                else
                {
                    _history.SwingStats.SuccessRateByDisplacement[key] = winRate;
                }
            }

            // Update by session
            foreach (var sessionGroup in swingsUsedForOTE.GroupBy(s => s.Session))
            {
                string key = sessionGroup.Key;
                int wins = sessionGroup.Count(s => s.OTEWorked);
                double winRate = (double)wins / sessionGroup.Count();

                if (_history.SwingStats.SuccessRateBySession.ContainsKey(key))
                {
                    double oldRate = _history.SwingStats.SuccessRateBySession[key];
                    _history.SwingStats.SuccessRateBySession[key] = oldRate * 0.7 + winRate * 0.3;
                }
                else
                {
                    _history.SwingStats.SuccessRateBySession[key] = winRate;
                }
            }

            // Update by direction
            foreach (var dirGroup in swingsUsedForOTE.GroupBy(s => s.Direction))
            {
                string key = dirGroup.Key;
                int wins = dirGroup.Count(s => s.OTEWorked);
                double winRate = (double)wins / dirGroup.Count();

                if (_history.SwingStats.SuccessRateByDirection.ContainsKey(key))
                {
                    double oldRate = _history.SwingStats.SuccessRateByDirection[key];
                    _history.SwingStats.SuccessRateByDirection[key] = oldRate * 0.7 + winRate * 0.3;
                }
                else
                {
                    _history.SwingStats.SuccessRateByDirection[key] = winRate;
                }
            }

            // Update optimal characteristics (favor winning swings)
            if (successfulOTEs.Any())
            {
                double avgSuccessfulSize = successfulOTEs.Average(s => s.SwingRangePips);
                double avgSuccessfulDuration = successfulOTEs.Average(s => s.SwingDurationBars);
                double avgSuccessfulDisplacement = successfulOTEs.Average(s => s.SwingDisplacementATR);

                _history.SwingStats.OptimalSwingRangePips =
                    _history.SwingStats.OptimalSwingRangePips * 0.8 + avgSuccessfulSize * 0.2;
                _history.SwingStats.OptimalSwingDuration =
                    _history.SwingStats.OptimalSwingDuration * 0.8 + avgSuccessfulDuration * 0.2;
                _history.SwingStats.OptimalSwingDisplacement =
                    _history.SwingStats.OptimalSwingDisplacement * 0.8 + avgSuccessfulDisplacement * 0.2;
            }
        }

        #endregion

        #region Helper Methods

        private void UpdateOteOutcome(double entryPrice, string outcome, double finalRR)
        {
            var ote = _currentDay.OtePatterns
                .Where(o => o.EntryExecuted && o.Outcome == "Pending")
                .OrderByDescending(o => o.Timestamp)
                .FirstOrDefault();

            if (ote != null)
            {
                ote.Outcome = outcome;
                ote.FinalRR = finalRR;
            }
        }

        private string GetDisplacementBucket(double atr)
        {
            if (atr < 0.15) return "0.00-0.15";
            if (atr < 0.20) return "0.15-0.20";
            if (atr < 0.25) return "0.20-0.25";
            if (atr < 0.30) return "0.25-0.30";
            return "0.30+";
        }

        /// <summary>
        /// NEW: Bucket swing sizes for statistical learning
        /// </summary>
        private string GetSwingSizeBucket(double pips)
        {
            if (pips < 10) return "0-10";
            if (pips < 15) return "10-15";
            if (pips < 20) return "15-20";
            if (pips < 25) return "20-25";
            if (pips < 30) return "25-30";
            if (pips < 40) return "30-40";
            return "40+";
        }

        /// <summary>
        /// NEW: Bucket swing durations for statistical learning
        /// </summary>
        private string GetSwingDurationBucket(double bars)
        {
            if (bars < 5) return "0-5";
            if (bars < 10) return "5-10";
            if (bars < 15) return "10-15";
            if (bars < 20) return "15-20";
            return "20+";
        }

        /// <summary>
        /// NEW: Bucket swing displacement for statistical learning
        /// </summary>
        private string GetSwingDisplacementBucket(double atr)
        {
            if (atr < 0.15) return "0.00-0.15";
            if (atr < 0.25) return "0.15-0.25";
            if (atr < 0.35) return "0.25-0.35";
            if (atr < 0.50) return "0.35-0.50";
            return "0.50+";
        }

        #endregion
    }
}
