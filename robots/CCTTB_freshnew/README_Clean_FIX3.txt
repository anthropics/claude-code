
CTrader Clean Separation FIX3
-----------------------------
Use these files to replace your project's sources (do NOT merge into JadecapStrategy.cs):

- Enums_Policies.cs
- JadecapStrategy.cs
- Execution_Entry_Confirmation.cs
- Execution_TradeManager.cs
- Signals_OptimalTradeEntryDetector.cs
- docs/presets/*.json

Steps:
1) Close cTrader/VS, back up your project.
2) Delete/Exclude any stray files like 'adecapStrategy.cs' or duplicate copies of JadecapStrategy.cs.
3) Copy the five .cs files above into your robot's source folder. Each file contains ONLY its own class.
4) Copy 'docs/presets' next to your output (or set JSONs to Content + Copy always).
5) Open project and Build.

If you still see 'private is not valid for this item' or 'Invalid token if/...' in JadecapStrategy.cs,
it means some code is still outside any method or class. Replace your JadecapStrategy.cs with the one in this package.

Server Time is UTC; enter sessions in UTC.
