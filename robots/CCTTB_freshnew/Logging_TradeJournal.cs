using System;
using System.Collections.Generic;
using System.IO;

namespace CCTTB
{
    public class TradeJournal
    {
        private readonly List<string> _entries;
        public bool EnableDebug { get; set; } = false;
        private readonly object _lock = new object();
        private Action<string> _printSink;
        
        public TradeJournal()
        {
            _entries = new List<string>();
        }
        
        public void LogTrade(TradeSignal signal, DateTime time)
        {
            var log = $"TRADE|{time:yyyy-MM-dd HH:mm:ss}|{signal.Direction}|Entry:{signal.EntryPrice}|Stop:{signal.StopLoss}|TP:{signal.TakeProfit}";
            lock (_lock)
            {
                _entries.Add(log);
            }
        }

        public void Debug(string message)
        {
            if (!EnableDebug) return;
            var line = $"DBG|{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}|{message}";
            lock (_lock)
            {
                _entries.Add(line);
            }
            try { _printSink?.Invoke(line); } catch { }
        }

        public void SaveToFile()
        {
            try
            {
                var folder = Path.Combine("data", "logs");
                Directory.CreateDirectory(folder);
                string filename = Path.Combine(folder, $"JadecapDebug_{DateTime.Now:yyyyMMdd_HHmmss}.log");
                lock (_lock)
                {
                    File.WriteAllLines(filename, _entries);
                }
            }
            catch (Exception ex)
            {
                try { _printSink?.Invoke($"DBG|SaveError|{ex.Message}"); } catch { }
            }
        }

        public void SetPrintSink(Action<string> sink)
        {
            _printSink = sink;
        }
    }
}
