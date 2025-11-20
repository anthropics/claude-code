using System;
using System.Collections.Generic;
using System.Linq;
using cAlgo.API;
using cAlgo.API.Indicators;

namespace CCTTB
{
    /// <summary>
    /// Analyzes price action dynamics to assess quality of moves (impulsive vs corrective)
    /// and momentum characteristics. Mimics how human traders "read" price action.
    /// </summary>
    public class PriceActionAnalyzer
    {
        private readonly Robot _robot;
        private readonly Bars _bars;
        private readonly AverageTrueRange _atr;
        private readonly bool _enableDebug;

        // Thresholds for classification
        private readonly double _impulsiveBodyRatio = 0.65;      // Body must be >65% of total range
        private readonly double _correctiveBodyRatio = 0.40;     // Body <40% of total range
        private readonly double _closeNearExtremeThreshold = 0.15; // Close within 15% of high/low
        private readonly double _overlapThreshold = 0.30;        // >30% overlap = corrective
        private readonly double _accelerationThreshold = 1.3;    // 30% increase = acceleration
        private readonly double _decelerationThreshold = 0.7;    // 30% decrease = deceleration

        public PriceActionAnalyzer(Robot robot, Bars bars, AverageTrueRange atr, bool enableDebug)
        {
            _robot = robot;
            _bars = bars;
            _atr = atr;
            _enableDebug = enableDebug;
        }

        #region Enums

        /// <summary>
        /// Classification of price movement quality
        /// </summary>
        public enum MoveQuality
        {
            StrongImpulsive,   // Very strong, conviction move
            Impulsive,         // Clear directional move
            Neutral,           // Neither clear impulse nor correction
            Corrective,        // Clear pullback/retracement
            WeakCorrective     // Very weak, choppy correction
        }

        /// <summary>
        /// Momentum state
        /// </summary>
        public enum MomentumState
        {
            Accelerating,      // Increasing strength
            Steady,            // Consistent strength
            Decelerating,      // Weakening strength
            Exhausted          // Very weak, potential reversal
        }

        #endregion

        #region Data Classes

        /// <summary>
        /// Analysis result for a sequence of bars
        /// </summary>
        public class PriceActionAnalysis
        {
            public MoveQuality Quality { get; set; }
            public MomentumState Momentum { get; set; }
            public BiasDirection Direction { get; set; }
            public double StrengthScore { get; set; }      // 0.0 - 1.0
            public double AverageBodyRatio { get; set; }
            public double OverlapRatio { get; set; }
            public bool ClosesNearExtreme { get; set; }
            public string Reasoning { get; set; }
        }

        /// <summary>
        /// Single candle characteristics
        /// </summary>
        public class CandleCharacteristics
        {
            public double BodySize { get; set; }
            public double TotalRange { get; set; }
            public double BodyRatio { get; set; }
            public double UpperWick { get; set; }
            public double LowerWick { get; set; }
            public bool IsBullish { get; set; }
            public double ClosePosition { get; set; }  // 0.0 (at low) to 1.0 (at high)
            public double SizeRelativeToATR { get; set; }
        }

        #endregion

        #region Main Analysis Methods

        /// <summary>
        /// Analyzes the quality of an MSS break by examining the bars that created the break
        /// </summary>
        public PriceActionAnalysis AnalyzeMSSBreak(MSSSignal mss, int barsToAnalyze = 5)
        {
            if (mss == null || _bars == null || _bars.Count < barsToAnalyze + 1)
                return CreateDefaultAnalysis("Insufficient data");

            try
            {
                // Find the bars that formed the MSS break
                int mssBarIndex = FindBarIndex(mss.Time);
                if (mssBarIndex < 0 || mssBarIndex < barsToAnalyze)
                    return CreateDefaultAnalysis("MSS bar not found");

                // Analyze bars leading up to and including the MSS break
                List<CandleCharacteristics> candles = new List<CandleCharacteristics>();
                for (int i = barsToAnalyze; i >= 0; i--)
                {
                    int index = mssBarIndex - i;
                    if (index >= 0 && index < _bars.Count)
                        candles.Add(AnalyzeCandle(index));
                }

                if (candles.Count == 0)
                    return CreateDefaultAnalysis("No candles analyzed");

                // Calculate aggregate metrics
                double avgBodyRatio = candles.Average(c => c.BodyRatio);
                double overlapRatio = CalculateOverlap(candles);
                bool closesNearExtreme = CheckClosesNearExtreme(candles, mss.Direction == BiasDirection.Bullish);
                double avgSizeVsATR = candles.Average(c => c.SizeRelativeToATR);

                // Classify quality
                MoveQuality quality = ClassifyMoveQuality(avgBodyRatio, overlapRatio, closesNearExtreme, avgSizeVsATR);

                // Analyze momentum
                MomentumState momentum = AnalyzeMomentum(candles);

                // Calculate strength score (0.0 - 1.0)
                double strengthScore = CalculateStrengthScore(avgBodyRatio, overlapRatio, closesNearExtreme, avgSizeVsATR, momentum);

                string reasoning = GenerateMSSReasoning(quality, momentum, avgBodyRatio, overlapRatio, closesNearExtreme);

                return new PriceActionAnalysis
                {
                    Quality = quality,
                    Momentum = momentum,
                    Direction = mss.Direction,
                    StrengthScore = strengthScore,
                    AverageBodyRatio = avgBodyRatio,
                    OverlapRatio = overlapRatio,
                    ClosesNearExtreme = closesNearExtreme,
                    Reasoning = reasoning
                };
            }
            catch (Exception ex)
            {
                if (_enableDebug)
                    _robot.Print($"[PA ANALYZER] Error analyzing MSS break: {ex.Message}");
                return CreateDefaultAnalysis($"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Analyzes the quality of a pullback/retracement move
        /// </summary>
        public PriceActionAnalysis AnalyzePullback(DateTime startTime, DateTime endTime, BiasDirection pullbackDirection)
        {
            if (_bars == null || _bars.Count < 3)
                return CreateDefaultAnalysis("Insufficient data");

            try
            {
                int startIndex = FindBarIndex(startTime);
                int endIndex = FindBarIndex(endTime);

                if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex)
                    return CreateDefaultAnalysis("Invalid time range");

                // Analyze bars in pullback
                List<CandleCharacteristics> candles = new List<CandleCharacteristics>();
                for (int i = startIndex; i <= endIndex && i < _bars.Count; i++)
                {
                    candles.Add(AnalyzeCandle(i));
                }

                if (candles.Count == 0)
                    return CreateDefaultAnalysis("No candles in range");

                // Calculate metrics
                double avgBodyRatio = candles.Average(c => c.BodyRatio);
                double overlapRatio = CalculateOverlap(candles);
                bool closesNearExtreme = CheckClosesNearExtreme(candles, pullbackDirection == BiasDirection.Bullish);
                double avgSizeVsATR = candles.Average(c => c.SizeRelativeToATR);

                // For pullbacks, we want CORRECTIVE quality (slow, overlapping)
                // Invert the classification logic
                MoveQuality quality = ClassifyPullbackQuality(avgBodyRatio, overlapRatio, avgSizeVsATR);
                MomentumState momentum = AnalyzeMomentum(candles);

                // For pullbacks, CORRECTIVE = HIGH strength (good for entry)
                double strengthScore = CalculatePullbackStrengthScore(quality, momentum, avgSizeVsATR);

                string reasoning = GeneratePullbackReasoning(quality, momentum, avgBodyRatio, overlapRatio);

                return new PriceActionAnalysis
                {
                    Quality = quality,
                    Momentum = momentum,
                    Direction = pullbackDirection,
                    StrengthScore = strengthScore,
                    AverageBodyRatio = avgBodyRatio,
                    OverlapRatio = overlapRatio,
                    ClosesNearExtreme = closesNearExtreme,
                    Reasoning = reasoning
                };
            }
            catch (Exception ex)
            {
                if (_enableDebug)
                    _robot.Print($"[PA ANALYZER] Error analyzing pullback: {ex.Message}");
                return CreateDefaultAnalysis($"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Analyzes recent bars for momentum shift (used for entry confirmation)
        /// </summary>
        public PriceActionAnalysis AnalyzeRecentMomentum(BiasDirection expectedDirection, int barsToCheck = 3)
        {
            if (_bars == null || _bars.Count < barsToCheck + 1)
                return CreateDefaultAnalysis("Insufficient data");

            try
            {
                List<CandleCharacteristics> candles = new List<CandleCharacteristics>();
                for (int i = barsToCheck; i >= 1; i--)
                {
                    int index = _bars.Count - 1 - i;
                    if (index >= 0)
                        candles.Add(AnalyzeCandle(index));
                }

                if (candles.Count == 0)
                    return CreateDefaultAnalysis("No recent candles");

                // Check if momentum is shifting back in expected direction
                bool momentumAligned = CheckMomentumAlignment(candles, expectedDirection);
                MomentumState momentum = AnalyzeMomentum(candles);
                double avgBodyRatio = candles.Average(c => c.BodyRatio);

                MoveQuality quality = momentumAligned ? MoveQuality.Impulsive : MoveQuality.Neutral;
                double strengthScore = momentumAligned ? 0.7 : 0.4;

                string reasoning = momentumAligned
                    ? $"Recent bars show momentum shifting {expectedDirection} (confirmation)"
                    : $"Recent bars lack clear {expectedDirection} momentum (neutral)";

                return new PriceActionAnalysis
                {
                    Quality = quality,
                    Momentum = momentum,
                    Direction = expectedDirection,
                    StrengthScore = strengthScore,
                    AverageBodyRatio = avgBodyRatio,
                    OverlapRatio = 0,
                    ClosesNearExtreme = momentumAligned,
                    Reasoning = reasoning
                };
            }
            catch (Exception ex)
            {
                if (_enableDebug)
                    _robot.Print($"[PA ANALYZER] Error analyzing recent momentum: {ex.Message}");
                return CreateDefaultAnalysis($"Error: {ex.Message}");
            }
        }

        #endregion

        #region Candle Analysis

        /// <summary>
        /// Analyzes a single candle's characteristics
        /// </summary>
        private CandleCharacteristics AnalyzeCandle(int index)
        {
            double open = _bars.OpenPrices[index];
            double high = _bars.HighPrices[index];
            double low = _bars.LowPrices[index];
            double close = _bars.ClosePrices[index];

            double bodySize = Math.Abs(close - open);
            double totalRange = high - low;
            double bodyRatio = totalRange > 0 ? bodySize / totalRange : 0;

            bool isBullish = close > open;
            double upperWick = isBullish ? (high - close) : (high - open);
            double lowerWick = isBullish ? (open - low) : (close - low);

            double closePosition = totalRange > 0 ? (close - low) / totalRange : 0.5;

            double atrValue = _atr.Result.Last((_bars.Count - 1) - index);
            double sizeRelativeToATR = atrValue > 0 ? totalRange / atrValue : 1.0;

            return new CandleCharacteristics
            {
                BodySize = bodySize,
                TotalRange = totalRange,
                BodyRatio = bodyRatio,
                UpperWick = upperWick,
                LowerWick = lowerWick,
                IsBullish = isBullish,
                ClosePosition = closePosition,
                SizeRelativeToATR = sizeRelativeToATR
            };
        }

        #endregion

        #region Classification Logic

        /// <summary>
        /// Classifies move quality for impulse moves (MSS breaks)
        /// </summary>
        private MoveQuality ClassifyMoveQuality(double avgBodyRatio, double overlapRatio, bool closesNearExtreme, double avgSizeVsATR)
        {
            // Strong impulsive: Large bodies, low overlap, closes near extreme, large size
            if (avgBodyRatio >= _impulsiveBodyRatio && overlapRatio < 0.2 && closesNearExtreme && avgSizeVsATR >= 1.2)
                return MoveQuality.StrongImpulsive;

            // Impulsive: Good body ratio, reasonable overlap, decent size
            if (avgBodyRatio >= 0.55 && overlapRatio < _overlapThreshold && avgSizeVsATR >= 0.9)
                return MoveQuality.Impulsive;

            // Corrective: Small bodies, high overlap, small size
            if (avgBodyRatio <= _correctiveBodyRatio || overlapRatio >= 0.5 || avgSizeVsATR < 0.7)
                return MoveQuality.Corrective;

            // Weak corrective: Very small bodies, very high overlap
            if (avgBodyRatio <= 0.25 || overlapRatio >= 0.7)
                return MoveQuality.WeakCorrective;

            return MoveQuality.Neutral;
        }

        /// <summary>
        /// Classifies pullback quality (inverted logic - corrective is GOOD for pullbacks)
        /// </summary>
        private MoveQuality ClassifyPullbackQuality(double avgBodyRatio, double overlapRatio, double avgSizeVsATR)
        {
            // For pullbacks, we WANT corrective (slow, overlapping)
            // Corrective pullback = HIGH quality for entry
            if (avgBodyRatio <= _correctiveBodyRatio && overlapRatio >= 0.4 && avgSizeVsATR < 0.8)
                return MoveQuality.Corrective; // GOOD for pullback

            // Impulsive pullback = LOW quality (too strong against trade direction)
            if (avgBodyRatio >= _impulsiveBodyRatio && overlapRatio < 0.3 && avgSizeVsATR >= 1.1)
                return MoveQuality.Impulsive; // BAD for pullback

            return MoveQuality.Neutral;
        }

        /// <summary>
        /// Analyzes momentum state from sequence of candles
        /// </summary>
        private MomentumState AnalyzeMomentum(List<CandleCharacteristics> candles)
        {
            if (candles.Count < 3)
                return MomentumState.Steady;

            // Compare recent candles to earlier candles
            double earlyAvgSize = candles.Take(candles.Count / 2).Average(c => c.TotalRange);
            double recentAvgSize = candles.Skip(candles.Count / 2).Average(c => c.TotalRange);

            if (earlyAvgSize <= 0)
                return MomentumState.Steady;

            double ratio = recentAvgSize / earlyAvgSize;

            if (ratio >= _accelerationThreshold)
                return MomentumState.Accelerating;
            else if (ratio <= _decelerationThreshold)
            {
                // Check if very weak
                if (ratio <= 0.5)
                    return MomentumState.Exhausted;
                return MomentumState.Decelerating;
            }

            return MomentumState.Steady;
        }

        #endregion

        #region Helper Methods

        /// <summary>
        /// Calculates overlap ratio between consecutive candles
        /// </summary>
        private double CalculateOverlap(List<CandleCharacteristics> candles)
        {
            if (candles.Count < 2)
                return 0;

            double totalOverlap = 0;
            int comparisons = 0;

            for (int i = 1; i < candles.Count; i++)
            {
                int prevIndex = _bars.Count - candles.Count + i - 1;
                int currIndex = _bars.Count - candles.Count + i;

                if (prevIndex < 0 || currIndex >= _bars.Count)
                    continue;

                double prevHigh = _bars.HighPrices[prevIndex];
                double prevLow = _bars.LowPrices[prevIndex];
                double currHigh = _bars.HighPrices[currIndex];
                double currLow = _bars.LowPrices[currIndex];

                double overlapHigh = Math.Min(prevHigh, currHigh);
                double overlapLow = Math.Max(prevLow, currLow);
                double overlap = Math.Max(0, overlapHigh - overlapLow);

                double avgRange = ((prevHigh - prevLow) + (currHigh - currLow)) / 2.0;
                if (avgRange > 0)
                {
                    totalOverlap += overlap / avgRange;
                    comparisons++;
                }
            }

            return comparisons > 0 ? totalOverlap / comparisons : 0;
        }

        /// <summary>
        /// Checks if candles consistently close near extreme (high for bullish, low for bearish)
        /// </summary>
        private bool CheckClosesNearExtreme(List<CandleCharacteristics> candles, bool bullish)
        {
            if (candles.Count == 0)
                return false;

            int closeNearExtremeCount = 0;

            foreach (var candle in candles)
            {
                if (bullish && candle.ClosePosition >= (1.0 - _closeNearExtremeThreshold))
                    closeNearExtremeCount++;
                else if (!bullish && candle.ClosePosition <= _closeNearExtremeThreshold)
                    closeNearExtremeCount++;
            }

            return (double)closeNearExtremeCount / candles.Count >= 0.6; // 60% of candles
        }

        /// <summary>
        /// Checks if recent momentum aligns with expected direction
        /// </summary>
        private bool CheckMomentumAlignment(List<CandleCharacteristics> candles, BiasDirection expectedDirection)
        {
            if (candles.Count == 0)
                return false;

            int alignedCount = 0;

            foreach (var candle in candles)
            {
                if ((expectedDirection == BiasDirection.Bullish && candle.IsBullish) ||
                    (expectedDirection == BiasDirection.Bearish && !candle.IsBullish))
                {
                    alignedCount++;
                }
            }

            return (double)alignedCount / candles.Count >= 0.6; // 60% aligned
        }

        /// <summary>
        /// Calculates strength score for impulse moves (0.0 - 1.0)
        /// </summary>
        private double CalculateStrengthScore(double avgBodyRatio, double overlapRatio, bool closesNearExtreme,
            double avgSizeVsATR, MomentumState momentum)
        {
            double score = 0;

            // Body ratio contribution (0-0.3)
            score += Math.Min(0.3, avgBodyRatio * 0.4);

            // Overlap contribution (0-0.2) - less overlap = higher score
            score += Math.Max(0, 0.2 * (1.0 - overlapRatio));

            // Closes near extreme (0-0.15)
            if (closesNearExtreme)
                score += 0.15;

            // Size vs ATR (0-0.2)
            score += Math.Min(0.2, avgSizeVsATR * 0.15);

            // Momentum bonus (0-0.15)
            if (momentum == MomentumState.Accelerating)
                score += 0.15;
            else if (momentum == MomentumState.Steady)
                score += 0.10;
            else if (momentum == MomentumState.Decelerating)
                score += 0.05;

            return Math.Min(1.0, score);
        }

        /// <summary>
        /// Calculates strength score for pullbacks (corrective = high score)
        /// </summary>
        private double CalculatePullbackStrengthScore(MoveQuality quality, MomentumState momentum, double avgSizeVsATR)
        {
            if (quality == MoveQuality.Corrective)
                return 0.8; // Good pullback
            else if (quality == MoveQuality.WeakCorrective)
                return 0.6; // Acceptable
            else if (quality == MoveQuality.Neutral)
                return 0.5;
            else if (quality == MoveQuality.Impulsive)
                return 0.3; // Bad - too strong pullback
            else
                return 0.2; // Very bad
        }

        /// <summary>
        /// Finds bar index for given time
        /// </summary>
        private int FindBarIndex(DateTime time)
        {
            for (int i = _bars.Count - 1; i >= 0; i--)
            {
                if (_bars.OpenTimes[i] <= time)
                    return i;
            }
            return -1;
        }

        /// <summary>
        /// Creates default analysis for error cases
        /// </summary>
        private PriceActionAnalysis CreateDefaultAnalysis(string reason)
        {
            return new PriceActionAnalysis
            {
                Quality = MoveQuality.Neutral,
                Momentum = MomentumState.Steady,
                Direction = BiasDirection.Neutral,
                StrengthScore = 0.5,
                AverageBodyRatio = 0.5,
                OverlapRatio = 0.5,
                ClosesNearExtreme = false,
                Reasoning = reason
            };
        }

        #endregion

        #region Reasoning Generation

        private string GenerateMSSReasoning(MoveQuality quality, MomentumState momentum,
            double avgBodyRatio, double overlapRatio, bool closesNearExtreme)
        {
            string qualityText = quality == MoveQuality.StrongImpulsive ? "Strong impulsive break" :
                                quality == MoveQuality.Impulsive ? "Impulsive break" :
                                quality == MoveQuality.Corrective ? "Weak corrective break" :
                                quality == MoveQuality.WeakCorrective ? "Very weak break" : "Neutral break";

            string momentumText = momentum == MomentumState.Accelerating ? "accelerating momentum" :
                                 momentum == MomentumState.Steady ? "steady momentum" :
                                 momentum == MomentumState.Decelerating ? "decelerating momentum" :
                                 "exhausted momentum";

            return $"{qualityText} with {momentumText} (Body={avgBodyRatio:F2}, Overlap={overlapRatio:F2}, CloseExtreme={closesNearExtreme})";
        }

        private string GeneratePullbackReasoning(MoveQuality quality, MomentumState momentum,
            double avgBodyRatio, double overlapRatio)
        {
            if (quality == MoveQuality.Corrective)
                return $"Clean corrective pullback (slow, overlapping) - IDEAL for entry (Body={avgBodyRatio:F2}, Overlap={overlapRatio:F2})";
            else if (quality == MoveQuality.Impulsive)
                return $"Strong impulsive pullback - CAUTION: May continue against trade direction (Body={avgBodyRatio:F2})";
            else
                return $"Neutral pullback quality (Body={avgBodyRatio:F2}, Overlap={overlapRatio:F2})";
        }

        #endregion
    }
}
