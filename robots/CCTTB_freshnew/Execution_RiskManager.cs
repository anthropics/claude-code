using cAlgo.API;
using cAlgo.API.Internals;
using System;

namespace CCTTB
{
    public class RiskManager
    {
        private readonly StrategyConfig _config;
        private readonly IAccount _account;  // FIXED: IAccount is the correct type in cTrader
        
        // FIXED: Accept IAccount (the interface type)
        public RiskManager(StrategyConfig config, IAccount account)
        {
            _config = config;
            _account = account;
        }
        
        // PHASE 4: Overload with confidence score for dynamic risk allocation
        public double CalculatePositionSize(double entryPrice, double stopLoss, Symbol symbol, double confidenceScore = 0.5)
        {
            double rawUnits;
            double unitsPerLot = symbol.LotSize;
            double stopDistancePips; // Declare at function scope for final logging

            // CRITICAL DEBUG LOGGING (Oct 23, 2025): Track position sizing to diagnose PID5 catastrophic loss (-$866 on 20-pip SL)
            Console.WriteLine($"═══════════════════════════════════════════════════════════════");
            Console.WriteLine($"[RISK CALC START] Entry={entryPrice:F5} SL={stopLoss:F5} Symbol={symbol.Name}");
            Console.WriteLine($"[RISK CALC] UnitsPerLot={unitsPerLot} PipSize={symbol.PipSize}");

            // PHASE 4: DYNAMIC RISK ALLOCATION - Map confidence to risk multiplier
            double riskMultiplier = 1.0; // Default
            if (confidenceScore >= 0.8)
                riskMultiplier = 1.5;  // High confidence: +50% position size
            else if (confidenceScore >= 0.6)
                riskMultiplier = 1.0;  // Medium confidence: standard size
            else if (confidenceScore >= 0.4)
                riskMultiplier = 0.5;  // Low confidence: -50% position size
            else
                riskMultiplier = 0.5;  // Very low: minimum size

            Console.WriteLine($"[PHASE 4 RISK] Confidence={confidenceScore:F2} → Multiplier={riskMultiplier:F2}x");

            // OPTION 1: Fixed lot size mode (ignores risk %, keeps constant position size)
            if (_config.UseFixedLotSize)
            {
                rawUnits = _config.FixedLotSize * unitsPerLot * riskMultiplier; // Apply multiplier
                stopDistancePips = Math.Abs(entryPrice - stopLoss) / symbol.PipSize;
                Console.WriteLine($"[RISK CALC] MODE: Fixed Lot Size (×{riskMultiplier:F2})");
                Console.WriteLine($"[RISK CALC] FixedLotSize={_config.FixedLotSize} lots × {riskMultiplier:F2} → RawUnits={rawUnits}");
            }
            else
            {
                // OPTION 2: Percentage-based risk sizing (original logic)
                Console.WriteLine($"[RISK CALC] MODE: Percentage-Based Risk (×{riskMultiplier:F2})");

                // 1) Risk budget in account currency (use Equity, not Balance)
                double equity = _account.Equity;
                double balance = _account.Balance;

                // CRITICAL FIX (Oct 23, 2025): Equity Sanity Check
                // PID5 catastrophic loss analysis revealed Equity was 240.5x inflated ($240,480 instead of $1,000)
                // This caused position sizing to be 240.5x too large (4.8 lots instead of 0.02 lots)
                // Protective cap: Equity should NEVER exceed 10x starting balance in normal trading
                double maxReasonableEquity = _account.Balance * 10.0; // Allow up to 10x balance growth
                bool equityClamped = false;
                if (equity > maxReasonableEquity && maxReasonableEquity > 0)
                {
                    Console.WriteLine($"[RISK CALC] ⚠️ CRITICAL WARNING: Equity=${equity:F2} exceeds 10x Balance (${maxReasonableEquity:F2})");
                    Console.WriteLine($"[RISK CALC] ⚠️ Clamping Equity to prevent catastrophic position sizing");
                    equity = maxReasonableEquity;
                    equityClamped = true;
                }

                // PHASE 4: Apply confidence-based risk multiplier
                double effectiveRiskPercent = _config.RiskPercent * riskMultiplier;
                double riskAmount = equity * (effectiveRiskPercent / 100.0);
                Console.WriteLine($"[RISK CALC] Equity=${equity:F2} Balance=${balance:F2}{(equityClamped ? " (CLAMPED)" : "")}");
                Console.WriteLine($"[RISK CALC] RiskPercent={_config.RiskPercent}% × {riskMultiplier:F2} = {effectiveRiskPercent:F2}% → RiskAmount=${riskAmount:F2}");

                // 2) Stop distance in pips (respect clamp)
                stopDistancePips = Math.Abs(entryPrice - stopLoss) / symbol.PipSize;
                Console.WriteLine($"[RISK CALC] StopDistance (raw)={stopDistancePips:F2} pips");

                if (stopDistancePips <= 0 || double.IsNaN(stopDistancePips) || double.IsInfinity(stopDistancePips))
                {
                    Console.WriteLine($"[RISK CALC] ⚠️ WARNING: Invalid stop distance, using MinStopPipsClamp={_config.MinStopPipsClamp}");
                    stopDistancePips = _config.MinStopPipsClamp;
                }
                stopDistancePips = Math.Max(stopDistancePips, _config.MinStopPipsClamp);
                Console.WriteLine($"[RISK CALC] StopDistance (clamped)={stopDistancePips:F2} pips");

                // 3) Pip value per unit (robust across asset classes)
                // Primary: use Symbol.PipValue (per lot) / LotSize
                double pipValuePerLot = symbol.PipValue;
                double pipValuePerUnit = (unitsPerLot > 0) ? (pipValuePerLot / unitsPerLot) : 0.0;
                Console.WriteLine($"[RISK CALC] PipValuePerLot=${pipValuePerLot:F6} → PipValuePerUnit=${pipValuePerUnit:F8}");

                // Secondary: derive from tick if needed: (TickValue / LotSize) * (PipSize / TickSize)
                if (pipValuePerUnit <= 0 || double.IsNaN(pipValuePerUnit) || double.IsInfinity(pipValuePerUnit))
                {
                    Console.WriteLine($"[RISK CALC] ⚠️ WARNING: Invalid pip value, using tick-based calculation");
                    double tickValPerLot = symbol.TickValue;
                    double tickSize = symbol.TickSize;
                    if (unitsPerLot > 0 && tickValPerLot > 0 && tickSize > 0 && symbol.PipSize > 0)
                    {
                        pipValuePerUnit = (tickValPerLot / unitsPerLot) * (symbol.PipSize / tickSize);
                        Console.WriteLine($"[RISK CALC] Tick-based: TickValue=${tickValPerLot:F6} TickSize={tickSize} → PipValuePerUnit=${pipValuePerUnit:F8}");
                    }
                }
                // Final fallback for majors only
                if (pipValuePerUnit <= 0 || double.IsNaN(pipValuePerUnit) || double.IsInfinity(pipValuePerUnit))
                {
                    Console.WriteLine($"[RISK CALC] ⚠️ WARNING: Using FALLBACK pip value for FX majors");
                    pipValuePerUnit = 10.0 / 100000.0; // $10 per lot pip on FX majors
                }

                // 4) Position units = Risk$ / (stop_pips * pip_value_per_unit)
                double denominator = stopDistancePips * pipValuePerUnit;
                Console.WriteLine($"[RISK CALC] Denominator = {stopDistancePips:F2} pips × ${pipValuePerUnit:F8} = ${denominator:F6}");

                rawUnits = riskAmount / denominator;
                Console.WriteLine($"[RISK CALC] RawUnits = ${riskAmount:F2} / ${denominator:F6} = {rawUnits:F2}");
            }

            // 5) Normalize and clamp to broker and user caps
            double unitsBeforeNormalize = rawUnits;
            double units = symbol.NormalizeVolumeInUnits(rawUnits);
            Console.WriteLine($"[RISK CALC] Normalized: {unitsBeforeNormalize:F2} → {units:F2}");

            units = Math.Max(units, symbol.VolumeInUnitsMin);
            Console.WriteLine($"[RISK CALC] After VolumeMin clamp ({symbol.VolumeInUnitsMin}): {units:F2}");

            // CRITICAL FIX (Oct 23, 2025): Hardcoded Maximum Position Size Cap
            // PID5 analysis showed position reached 480,960 units (4.8 lots) due to no upper cap
            // Add absolute maximum regardless of config setting to prevent catastrophic losses
            // UPDATED: Lowered from 1.0 lot to 0.5 lot after verification showed 1.6 lot positions still occurring
            double hardMaxUnits = 50000.0; // Absolute max: 0.5 lot (50,000 units)
            if (units > hardMaxUnits)
            {
                Console.WriteLine($"[RISK CALC] ⚠️ CRITICAL: Position size {units:F2} units exceeds HARD MAX {hardMaxUnits:F2} units!");
                Console.WriteLine($"[RISK CALC] ⚠️ Clamping to {hardMaxUnits:F2} units (0.5 lot) to prevent account destruction");
                units = hardMaxUnits;
            }

            if (_config.MaxVolumeUnits > 0)
            {
                double unitsBeforeMaxClamp = units;
                units = Math.Min(units, _config.MaxVolumeUnits);
                if (unitsBeforeMaxClamp != units)
                    Console.WriteLine($"[RISK CALC] ⚠️ Config MaxVolumeUnits clamp: {unitsBeforeMaxClamp:F2} → {units:F2}");
            }

            double unitsBeforeMaxBrokerClamp = units;
            units = Math.Min(units, symbol.VolumeInUnitsMax);
            if (unitsBeforeMaxBrokerClamp != units)
                Console.WriteLine($"[RISK CALC] ⚠️ Broker VolumeMax clamp ({symbol.VolumeInUnitsMax}): {unitsBeforeMaxBrokerClamp:F2} → {units:F2}");

            double lots = units / unitsPerLot;
            double expectedLossAtSL = stopDistancePips * (symbol.PipValue / unitsPerLot) * units;

            Console.WriteLine($"[RISK CALC FINAL] Units={units:F2} ({lots:F4} lots)");
            Console.WriteLine($"[RISK CALC FINAL] Expected loss at SL = {stopDistancePips:F2} pips × ${symbol.PipValue / unitsPerLot:F8}/unit × {units:F2} units = ${expectedLossAtSL:F2}");
            Console.WriteLine($"═══════════════════════════════════════════════════════════════");

            return units;
        }
        
        public double CalculateTakeProfit(double entryPrice, double stopLoss)
        {
            double risk = Math.Abs(entryPrice - stopLoss);
            double reward = risk * _config.MinRiskReward;
            
            return entryPrice > stopLoss ? entryPrice + reward : entryPrice - reward;
        }
        
        public bool IsRiskRewardAcceptable(double entry, double stop, double target)
        {
            double risk = Math.Abs(entry - stop);
            double reward = Math.Abs(target - entry);
            double actualRR = risk > 0 ? (reward / risk) : 0;
            bool acceptable = actualRR >= _config.MinRiskReward;

            // DEBUG logging for ALL RR checks (to see actual MinRR value in runtime)
            Console.WriteLine($"[RR CHECK] {'{'}{(acceptable ? "PASS" : "REJECTED")}{'}'} | Entry={entry:F5} SL={stop:F5} TP={target:F5} | Risk={risk:F5} Reward={reward:F5} | Actual RR={actualRR:F2} | Required MinRR={_config.MinRiskReward:F2}");

            return acceptable;
        }
    }
}
