using System;

namespace CCTTB
{
    /// <summary>
    /// Abstraction for drawing MSS-related visuals.
    /// Implemented by CTPlotter (or any other plotter) to keep drawing code decoupled from strategy logic.
    /// Kept in the root namespace for cTrader compatibility (simpler lookup in Automate runtime).
    /// </summary>
    public interface IPlotter
    {
        void DrawMSSLabel(DateTime time, double price, MSSType type, string text);
        void DrawBrokenLevel(DateTime time, double price);
        void DrawZone(DateTime startTime, double low, double high, string label, bool bullish);
    }
}
