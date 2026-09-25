# Inventory Ops — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- A parent ASIN may map to multiple child ASINs and SKUs. Always resolve to specific SKUs before running inventory analysis.
- SKU lookup must specify both company ID and marketplace — the same SKU code may exist in different marketplaces with different inventory.
- Inventory position has four components: FBA available (sellable now), Inbound (in transit to FBA), Warehouse stock (in own/3PL warehouses), and WIP orders (purchase orders placed but not yet received).
- Days of supply should be calculated two ways: FBA-only (available stock ÷ daily velocity) and with inbound (available + inbound ÷ daily velocity). Both are needed for risk assessment.
- Two warehouses can have identical names but different backend IDs (warehouse clones). Always verify warehouse IDs, not just names.
- AWD (Amazon Warehousing and Distribution) warehouses are distinct from Amazon FBA warehouses. Inventory in AWD must be shipped to FBA before it becomes available for sale.
- WIP orders (Work In Progress) represent purchase orders that have been placed but not yet received. They should not be counted as available stock but are part of total coverage calculations.
- When a SKU is not found in a company, check: correct marketplace, active vs archived status, spelling/format of the identifier, and whether it's set up in NeonPanel at all.
- Inventory snapshots from supply_chain_inspect_inventory_sku_snapshot reflect a point-in-time view. Inbound quantities change as shipments are received.
- Warehouse type (FBA, AWD, 3PL, own) determines how inventory is managed and which replenishment rules apply.
