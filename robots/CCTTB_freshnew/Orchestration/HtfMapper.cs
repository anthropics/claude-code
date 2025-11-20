using cAlgo.API;
using System;

namespace CCTTB
{
    public class HtfMapper
    {
        public (TimeFrame primary, TimeFrame secondary) GetHtfPair(TimeFrame chartTf)
        {
            // CRITICAL FIX (Oct 25): Align with Power of Three HTF bias logic
            // For intraday trading, bias should come from 4H/Daily timeframes

            // Chart 5m → HTF 1H + 4H (intermediate + directional bias)
            if (chartTf == TimeFrame.Minute5)
                return (TimeFrame.Hour, TimeFrame.Hour4);

            // Chart 15m → HTF 4H + 1D (as per TradingView HTF overlay best practice)
            if (chartTf == TimeFrame.Minute15)
                return (TimeFrame.Hour4, TimeFrame.Daily);

            // Unsupported
            throw new ArgumentException($"Chart TF {chartTf} not supported for HTF mapping. Use 5m or 15m.");
        }

        public string GetHtfLabel(TimeFrame htf)
        {
            if (htf == TimeFrame.Minute5) return "5m";
            if (htf == TimeFrame.Minute15) return "15m";
            if (htf == TimeFrame.Hour) return "1H";
            if (htf == TimeFrame.Hour4) return "4H";
            if (htf == TimeFrame.Daily) return "1D";
            if (htf == TimeFrame.Weekly) return "1W";
            return htf.ToString();
        }

        public bool IsSupported(TimeFrame chartTf)
        {
            return chartTf == TimeFrame.Minute5 || chartTf == TimeFrame.Minute15;
        }
    }
}
