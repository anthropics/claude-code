
using System;

namespace CCTTB.MSS.Core.Maths
{
    public class ATR
    {
        private readonly int _period;
        private double _prevClose;
        private double _value;
        private bool _primed;
        private int _count;

        public ATR(int period) { _period = Math.Max(1, period); }
        public double Value => _value;
        public bool IsReady => _primed;

        public double Step(double high, double low, double close)
        {
            var tr = _count == 0 ? (high - low) : Math.Max(Math.Max(high - low, Math.Abs(high - _prevClose)), Math.Abs(low - _prevClose));
            _count++;
            if (_count < _period) { _value += tr; if (_count == _period - 1) _value /= Math.Max(1, _count); }
            else if (_count == _period) { _value = (_value + tr) / _period; _primed = true; }
            else { _value = (_value * (_period - 1) + tr) / _period; }
            _prevClose = close;
            return _value;
        }
    }
}
