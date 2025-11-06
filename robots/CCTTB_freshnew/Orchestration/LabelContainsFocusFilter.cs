using System;

namespace CCTTB.Orchestration
{
    public sealed class LabelContainsFocusFilter : ISignalFilter
    {
        public bool Allow(TradeSignal s, OrchestratorPreset activePreset)
        {
            if (s == null) return false;
            var focus = activePreset?.Focus ?? "";
            if (string.IsNullOrWhiteSpace(focus)) return true;
            var label = s.Label ?? "";
            return label.IndexOf(focus, StringComparison.OrdinalIgnoreCase) >= 0;
        }
    }
}
