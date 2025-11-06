using System;

namespace CCTTB
{
    public static class PoiTouch
    {
        public static bool IsPriceInOteZone(double price, OTEZone z, double tol)
        {
            // True OTE band: 0.618–0.79 of the swing
            double lo = Math.Min(z.OTE618, z.OTE79);
            double hi = Math.Max(z.OTE618, z.OTE79);
            return price >= (lo - tol) && price <= (hi + tol);
        }

        public static bool IsPriceInOrderBlock(double price, OrderBlock ob, double tol)
        {
            double lo = Math.Min(ob.LowPrice,  ob.HighPrice);
            double hi = Math.Max(ob.LowPrice,  ob.HighPrice);
            return price >= (lo - tol) && price <= (hi + tol);
        }
    }
}
