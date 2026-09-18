# Logistics — Module Map

## log-warehouse

Warehouse and location operations — managing warehouse transfers, resolving location mismatches, inventory balance verification, duplicate FnSKU detection, and inter-warehouse movement tracking.

**Common user intents:**
- Transfer is stuck
- Location mismatch
- Inventory balance is wrong
- How do I verify end-of-month balances?
- Duplicate FnSKU issue
- Where is my inventory?

**Common confusions:**
- Not understanding that goods in transit are in a separate state between Origin and Destination
- Confusing warehouse-level inventory with SKU-level inventory
- Not checking the Inventory Duplicates Report regularly

**Artifacts to request:**
- Warehouse name or ID
- Transfer ID
- Date range for balance check
- FnSKU in question

**Key objects:** Warehouse, Location, Transfer, Inventory balance, Inventory audit, FnSKU duplicate, Transit state, Inventory Duplicates Report
