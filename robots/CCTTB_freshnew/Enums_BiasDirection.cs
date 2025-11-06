namespace CCTTB
{
    // Direction enum
    public enum BiasDirection
    {
        Bearish = -1,
        Neutral = 0,
        Bullish = 1
    }

    // Dropdown choices for Bias timeframe
    public enum BiasTfOption
    {
        Daily, H8, H4, H2, H1, M30, M15
    }

    // PHASE 2: Market Regime Detection
    public enum MarketRegime
    {
        Ranging,      // ADX < 20 - Low trend strength, range-bound market
        Trending,     // ADX > 25 - Strong trend
        Volatile,     // ATR spike - High volatility
        Quiet         // Low volatility
    }
}
