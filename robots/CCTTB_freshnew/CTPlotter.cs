using System;
using cAlgo.API;

namespace CCTTB
{
    /// <summary>
    /// Minimal, safe plotter for MSS labels and zones.
    /// Kept simple to match cTrader Automate (CBot) APIs.
    /// </summary>
    public class CTPlotter : IPlotter
    {
        private readonly Chart _chart;

        public CTPlotter(Chart chart)
        {
            _chart = chart;
        }

        public void DrawMSSLabel(DateTime time, double price, MSSType type, string text)
        {
            var color = (type == MSSType.Bullish) ? Color.SeaGreen : Color.Tomato;
            _chart.DrawText("MSS_" + time.Ticks, text ?? "MSS", time, price, color);
        }

        public void DrawBrokenLevel(DateTime time, double price)
        {
            _chart.DrawHorizontalLine("MSS_LVL_" + time.Ticks, price, Color.Gray);
        }

        public void DrawZone(DateTime startTime, double low, double high, string label, bool bullish)
        {
            if (high < low) { var tmp = high; high = low; low = tmp; }
            var c = bullish ? Color.SeaGreen : Color.Tomato;
            var right = startTime.AddMinutes(250);
            _chart.DrawRectangle("FOI_" + startTime.Ticks, startTime, high, right, low, c);
            var mid = (low + high) * 0.5;
            _chart.DrawText("FOI_L_" + startTime.Ticks, label ?? "FOI", startTime, mid, c);
        }
    }
}
