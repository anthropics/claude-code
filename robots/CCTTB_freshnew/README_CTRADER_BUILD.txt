cTrader Build Notes (Fixed Multi-File)
-------------------------------------
Include & Compile these files:
 - Enums_Policies.cs
 - JadecapStrategy.cs
 - Execution_Entry_Confirmation.cs
 - Execution_TradeManager.cs
 - Signals_OptimalTradeEntryDetector.cs

Presets: docs/presets/*.json
 - In Visual Studio: Build Action=Content, Copy to Output=Copy always
 - Or copy the whole 'docs' folder next to the final DLL/EXE

If errors:
 - Add 'using JadecapStrategyBot;' at top of Signals_OptimalTradeEntryDetector.cs (already added).
 - If Bars.OpenTimes.GetIndexByTime() is missing, helper GetIndexByTimeSafe() is included and used.
 - Ensure EntryConfirmation.IsEntryAllowed(raw, idxMap) overload is present (strict sequencing).

Server Time: UTC
 - Enter sessions/killzones in UTC (NormalizeSessionsToServerUtc is active).
