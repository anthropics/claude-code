# Planning And Forecasting — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- NeonPanel's Planning and Forecasting module allows users to forecast using historical data combined with promotional goals and plans.
- Historical data alone cannot predict increased sales velocity for a specific SKU when promotional goals (e.g., achieving top-3 organic ranking on Amazon) are in play.
- Increased sales velocity from promotional goals requires inventory planning to ensure the SKU does not go out of stock.
- For FBA replenishment shipments, NeonPanel uses Amazon Ledger data to calculate replenishment suggestions, not NeonPanel calculated inventory data.
- NeonPanel maintains two streams of inventory quantity data: CALCULATED data (derived from NeonPanel inventory management transactions like Inventory Orders, FBA Shipments, AWD Shipments, Non-Amazon Shipments, Invoices, and Inventory Adjustments) and 3PL data (from external sources such as Amazon Ledger).
- 3PL inventory balances can be imported into NeonPanel via the Import feature.
- PO planning requires four validated inputs before any tool calls: identifier type (parent ASIN, child ASIN, SKU, or product family), forecast scenario name, planning parameters (lead time, safety stock, PO cadence, horizon), and scope (which SKUs, which marketplace).
- When the user provides a parent ASIN, trust their input immediately and go directly to the supply chain analysis tools. Do NOT call neonpanel_listInventoryItems to pre-validate or resolve it — the supply chain tools handle parent-to-child resolution natively.
- The supply chain tools (supply_chain_analyze_sales_velocity_mcp_neonpanel, supply_chain_list_po_placement_candidates_mcp_neonpanel, supply_chain_inspect_inventory_sku_snapshot_mcp_neonpanel) accept a parent_asin array parameter and automatically return data for all child SKUs.
- The correct tool sequence when a parent ASIN is provided: (1) supply_chain_inspect_inventory_sku_snapshot with parent_asin, (2) supply_chain_analyze_sales_velocity with parent_asin, (3) supply_chain_list_product_logistics_parameters, (4) supply_chain_list_po_placement_candidates with parent_asin.
- The correct tool sequence when a SKU or child ASIN is provided: (1) neonpanel_listInventoryItems to confirm it exists, (2) supply_chain_inspect_inventory_sku_snapshot, (3) supply_chain_list_product_logistics_parameters, (4) supply_chain_list_po_placement_candidates.
- When supply_chain_list_po_placement_candidates returns empty results, the root cause is one of: SKU not found in snapshot, lead_time_days not configured, safety_stock_days not configured, wrong forecast scenario assigned, or SKU not flagged as actively sold.
- A forecast scenario mismatch occurs when the user requests a specific scenario (e.g., promo_shift_128_growth_v2) but the SKU is assigned a different scenario (e.g., Recency-Weighted Conservative). The mismatch must be reported with impact analysis before proceeding.
- Lead time and safety stock can be configured at the SKU level or fall back to company defaults. When neither is set, this is a critical configuration gap that must be reported before PO planning can proceed.
- PO recommendations must include five sections: Current Inventory (available, inbound, warehouse, WIP, total coverage), Sales Forecast (current velocity, peak velocity, 30/60 day projections), Risk Assessment (days of supply FBA-only vs. with inbound), PO Recommendation (quantity, timing, arrival window, rationale), and Next Steps (actionable checklist).
- Safety stock calculations use class-based multipliers (e.g., Class A items use a 1.2x multiplier on base safety stock days).
- Escalation is required when: data exists in one system but not another (data integrity), no lead time AND no company default exists (missing critical config), the same tool query returns different results on retry (unexpected results), or multiple valid PO quantities exist with different trade-offs (user decision required).
- The planning_base parameter controls which SKUs are included in PO placement: 'actively_sold_only' includes only active SKUs, 'all' includes all SKUs regardless of status.
- PO cadence defines how frequently purchase orders are placed (e.g., every 30 days). It affects recommended PO timing and quantity calculations.
- When a tool returns empty results, never re-run the same tool with the same parameters. Instead, follow the diagnostic tree to identify the root cause before retrying with corrected inputs.
- All intake clarifications (identifier, scenario, parameters, scope) must be collected in a single structured request — not spread across multiple back-and-forth exchanges.
- When presenting PO recommendations, always state a clear recommendation with rationale. Never end with 'Option 1 or Option 2?' without providing a recommended choice and explaining the trade-offs.
- The agent cannot change forecast scenarios directly — scenario changes must be made by the user in NeonPanel. The agent should provide step-by-step instructions for applying the correct scenario.
- Data validation results must be reported with clear status indicators: ✅ for confirmed, ❌ for missing/failed, ⚠️ for using defaults or requiring attention.
- When multiple SKUs exist under a parent ASIN, each SKU may have different forecast scenarios, lead times, and safety stock configurations. Validate each SKU independently.
- When a parent ASIN returns fewer SKUs than expected, cross-check by querying the product_family field — product family is manually curated by the team and more reliable than parent ASIN mappings, which can be stale, null, or broken due to Amazon catalog syncs.
- Always show every product variant individually in its own row. Never collapse SKUs into combined columns or 'other' buckets without explicit user permission.
- When analyzing a product family, state how many variants were found and ask the user to confirm the count before proceeding with analysis.
- Do not expand analysis scope beyond what the user requested. If they want to plan one product family, plan one product family.
- If the user declines or redirects a suggestion, stop making that suggestion. Do not circle back to it unprompted.
- When the user provides an additional ASIN mid-conversation, immediately add it to the parent_asin array parameter — do not treat it as a separate lookup requiring new validation.
- Product family (product_family field) is more reliable than parent ASIN for finding all variants because: (1) it is manually curated by the team, not dependent on Amazon catalog sync, (2) parent ASIN mappings can be stale, null, or missing for new variants, and (3) product family catches cross-parent items if ASINs are split or merged.
- When the user asks to 'show me the family' or analyze a product family, always use the two-step lookup: first query by parent_asin to find initial items, then identify the product_family from those results and re-query by product_family to catch any orphaned variants with null or mismatched parent ASIN mappings.
- Any variant found via product_family lookup that has a null or mismatched parent_asin should be flagged to the user as a data integrity issue — the parent ASIN mapping needs to be fixed in the catalog.
