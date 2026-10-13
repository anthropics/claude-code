# Inventory Validation — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- A parent ASIN may map to multiple child ASINs and SKUs. Always resolve to specific SKUs before running any inventory or planning analysis.
- SKU lookup must specify both company ID and marketplace — the same SKU code may exist in different marketplaces with different inventory data.
- Inventory position has four components: FBA available (sellable now), Inbound (in transit to FBA), Warehouse stock (in own/3PL warehouses), and WIP orders (purchase orders placed but not yet received).
- Two warehouses can have identical names but different backend IDs (warehouse clones). Always verify warehouse IDs, not just names.
- AWD (Amazon Warehousing and Distribution) warehouses are distinct from Amazon FBA warehouses. Inventory in AWD must be shipped to FBA before it becomes available for sale.
- WIP orders represent purchase orders placed but not yet received. They should not be counted as available stock but are part of total coverage calculations.
- When a SKU is not found in a company, check: correct marketplace, active vs. archived status, spelling/format of the identifier, and whether it's set up in NeonPanel.
- Lead time and safety stock can be configured at the SKU level or fall back to company defaults. When neither is set, this is a critical configuration gap.
- For multi-SKU families, each SKU must be validated independently — they may have different lead times, safety stock, forecast scenarios, and planning status.
- Warehouse type (FBA, AWD, 3PL, own) determines how inventory is managed and which replenishment rules apply.
- When the user states an identifier is a parent ASIN, trust their input immediately. Do not run neonpanel_listInventoryItems to validate it — go directly to the parent-ASIN-aware supply chain tools.
- The supply chain tools (supply_chain_analyze_sales_velocity, supply_chain_list_po_placement_candidates, supply_chain_inspect_inventory_sku_snapshot) accept a parent_asin parameter and automatically resolve to all child SKUs. Use them directly instead of pre-resolving.
- Never pre-resolve a parent ASIN to child ASINs using neonpanel_listInventoryItems. The supply chain tools handle parent-to-child resolution natively.
- When the user provides an additional ASIN during a conversation, add it to the existing parent_asin filter array immediately — do not start a new validation flow.
- Product family (product_family field) is more reliable than parent ASIN for finding all variants because: (1) it is manually curated by the team, not dependent on Amazon catalog sync, (2) parent ASIN mappings can be stale, null, or missing for new variants, and (3) product family catches cross-parent items if ASINs are split or merged.
- When resolving a product family, always use the two-step lookup: first query by parent_asin to find initial items, then identify the product_family from those results and re-query by product_family to catch orphaned variants with null or mismatched parent ASIN mappings.
- Any variant found via product_family lookup that has a null or mismatched parent_asin should be flagged to the user as a data integrity issue — the parent ASIN mapping needs to be fixed in the catalog.
- When a parent ASIN query returns fewer SKUs than expected, always cross-check by product_family before concluding the family is complete.
