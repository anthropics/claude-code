using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    public class EntryConfirmation
    {
        private readonly StrategyConfig _config;

        public EntryConfirmation(StrategyConfig config)
        {
            _config = config;
        }

        /// <summary>
        /// Returns true if current confirmations meet the configured rules.
        /// - If UseScoring = true: sum weights and compare to ScoreMinTotal (distinct tags, with MSS variants deduped if CountMSSOnce).
        /// - Else if EnableMultiConfirmation = true: require 1/2/3 distinct canonical tags per ConfirmationMode.
        /// - Else: at least one tag.
        /// Always honors RequireMSSForEntry if enabled (accepts MSS, MSS_CTM, or MSS_Retest).
        /// </summary>
        public bool IsEntryAllowed(List<string> confirmedZones)
        {
            var raw = (confirmedZones ?? new List<string>())
                      .Where(s => !string.IsNullOrWhiteSpace(s))
                      .Select(s => s.Trim())
                      .ToList();

            // Normalize / canonicalize for counting & scoring
            // - OB aliases -> "OB"
            // - LiquiditySweep aliases -> "Sweep"
            // - MSS_CTM collapses to MSS only if CountMSSOnce is true
            var canonical = Canonicalize(raw, collapseMssCtm: _config.CountMSSOnce);

            // New unified gate evaluation (takes precedence over legacy flags when set)
            var canSet = new HashSet<string>(canonical.Select(x => x.ToUpperInvariant()));
            bool Has(string tag) => canSet.Contains(tag.ToUpperInvariant());
            bool HasMSS() => Has("MSS") || Has("MSS_CTM") || Has("MSS_RETEST");

            if (_config.EntryGateMode != EntryGateMode.Any)
            {
                switch (_config.EntryGateMode)
                {
                    case EntryGateMode.MSSOnly:
                        if (!HasMSS()) return false;
                        break;

                    case EntryGateMode.MSS_and_OTE:
                        if (!(HasMSS() && Has("OTE"))) return false;
                        break;

                    case EntryGateMode.Triple:
                        if (!(HasMSS() && Has("BREAKER") && Has("IFVG"))) return false;
                        
                        if (_config.StrictSequence)
                        {
                            if (!(Has("SWEEP") && Has("MSS") && Has("BREAKER") && Has("IFVG"))) return false;
                        }
        break;

                    case EntryGateMode.Scoring:
                        // Defer to scoring block below; legacy multi-confirm flags are ignored
                        break;
                }
                // If a unified mode (except Scoring) already passed, allow early return
                if (_config.EntryGateMode != EntryGateMode.Scoring)
                    return true;
            }


            // Optional hard gate: require ANY MSS variant present
            bool hasMssTag = raw.Any(z => z.Equals("MSS", StringComparison.OrdinalIgnoreCase) || z.Equals("MSS_CTM", StringComparison.OrdinalIgnoreCase) || z.Equals("MSS_Retest", StringComparison.OrdinalIgnoreCase));
            if (_config.RequireMSSForEntry && !hasMssTag) return false;

            // Entry Presets (from frames)
            if (_config.EntryPreset != EntryPresetEnum.None)
            {
                var can = Canonicalize(raw, collapseMssCtm: _config.CountMSSOnce)
                          .Select(x => x.ToUpperInvariant())
                          .ToHashSet();
                if (_config.EntryPreset == EntryPresetEnum.ModelA_MSS_OTE)
                {
                    if (!(can.Contains("MSS") && can.Contains("OTE"))) return false;
                }
                else if (_config.EntryPreset == EntryPresetEnum.ModelB_MSS_IFVG)
                {
                    if (!(can.Contains("MSS") && can.Contains("IFVG"))) return false;
                }
                else if (_config.EntryPreset == EntryPresetEnum.ModelC_Breaker_IFVG)
                {
                    if (!(can.Contains("BREAKER") && can.Contains("IFVG"))) return false;
                }
            }

            // Video-first behavior: if MSS tag is present, allow downstream BuildSignal to enforce strict gates
            if (hasMssTag && !_config.UseScoring && !_config.EnableMultiConfirmation && !_config.RequireTripleConfirmation && !_config.RequireMSSandOTE && _config.EntryPreset == EntryPresetEnum.None)
                return true;

            // Optional stricter gate: require BOTH MSS and OTE for entry
            if (_config.RequireMSSandOTE)
            {
                bool hasMss = raw.Any(z => z.Equals("MSS", StringComparison.OrdinalIgnoreCase) ||
                                           z.Equals("MSS_CTM", StringComparison.OrdinalIgnoreCase) ||
                                           z.Equals("MSS_Retest", StringComparison.OrdinalIgnoreCase));
                var canonicalTmp = Canonicalize(raw, collapseMssCtm: _config.CountMSSOnce);
                bool hasOte = canonicalTmp.Any(z => z.Equals("OTE", StringComparison.OrdinalIgnoreCase));
                if (!(hasMss && hasOte)) return false;
            }

            // Optional 3-confirmation: require MSS + Breaker + IFVG present
            if (_config.RequireTripleConfirmation)
            {
                var can = Canonicalize(raw, collapseMssCtm: _config.CountMSSOnce).Select(x => x.ToUpperInvariant()).ToHashSet();
                bool hasMss = can.Contains("MSS");
                bool hasBrk = can.Contains("BREAKER");
                bool hasFvg = can.Contains("IFVG");
                if (!(hasMss && hasBrk && hasFvg)) return false;
            }

            if (_config.UseScoring)
            {
                // Score over DISTINCT canonical tags (prevents double counting same tag)
                int total = ComputeScore(canonical.Distinct(StringComparer.OrdinalIgnoreCase));
                return total >= _config.ScoreMinTotal;
            }

            // Distinct-count path
            if (!_config.EnableMultiConfirmation)
                return canonical.Any();

            int required = _config.ConfirmationMode switch
            {
                EntryConfirmationModeEnum.Single => 1,
                EntryConfirmationModeEnum.Double => 2,
                EntryConfirmationModeEnum.Triple => 3,
                _ => 1
            };

            int distinctCount = canonical.Distinct(StringComparer.OrdinalIgnoreCase).Count();
            return distinctCount >= required;
        }

        private IEnumerable<string> Canonicalize(IEnumerable<string> zones, bool collapseMssCtm)
        {
            foreach (var z in zones)
            {
                var t = z.Trim();

                // Group OB synonyms
                if (t.Equals("OrderBlock", StringComparison.OrdinalIgnoreCase)) { yield return "OB"; continue; }

                // Group sweep synonyms
                if (t.Equals("LiquiditySweep", StringComparison.OrdinalIgnoreCase)) { yield return "Sweep"; continue; }

                // FVG/IFVG aliases
                if (t.Equals("FVG", StringComparison.OrdinalIgnoreCase) || t.Equals("FairValueGap", StringComparison.OrdinalIgnoreCase)) { yield return "IFVG"; continue; }

                // Optionally collapse MSS_CTM into MSS
                if (collapseMssCtm && t.Equals("MSS_CTM", StringComparison.OrdinalIgnoreCase)) { yield return "MSS"; continue; }

                yield return t; // keep as-is otherwise (MSS, MSS_Retest, OTE, etc.)
            }
        }

        private int ComputeScore(IEnumerable<string> tagsDistinct)
        {
            if (tagsDistinct == null) return 0;

            int score = 0;
            foreach (var z in tagsDistinct)
            {
                if (z.Equals("MSS", StringComparison.OrdinalIgnoreCase) ||
                    z.Equals("MSS_CTM", StringComparison.OrdinalIgnoreCase))
                {
                    score += _config.Score_MSS;
                }
                else if (z.Equals("MSS_Retest", StringComparison.OrdinalIgnoreCase))
                {
                    score += _config.Score_MSS_Retest;
                }
                else if (z.Equals("OTE", StringComparison.OrdinalIgnoreCase))
                {
                    score += _config.Score_OTE;
                }
                else if (z.Equals("OB", StringComparison.OrdinalIgnoreCase) ||
                         z.Equals("OrderBlock", StringComparison.OrdinalIgnoreCase))
                {
                    score += _config.Score_OB;
                }
                else if (z.Equals("Sweep", StringComparison.OrdinalIgnoreCase) ||
                         z.Equals("LiquiditySweep", StringComparison.OrdinalIgnoreCase))
                {
                    score += _config.Score_Sweep;
                }
                else if (z.Equals("IFVG", StringComparison.OrdinalIgnoreCase) || z.Equals("FVG", StringComparison.OrdinalIgnoreCase))
                {
                    score += _config.Score_IFVG;
                }
                else if (z.Equals("Breaker", StringComparison.OrdinalIgnoreCase))
                {
                    score += _config.Score_Breaker;
                }
                else
                {
                    score += _config.Score_Default;
                }
            }
            return score;
        }
    }
}

