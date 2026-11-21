# Po Planning Workflow — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- PO planning requires four validated inputs before any tool calls: identifier type, forecast scenario, planning parameters (lead time, safety stock, PO cadence, horizon), and scope.
- All intake clarifications must be collected in a single structured request — not spread across multiple back-and-forth exchanges.
- The correct tool sequence for PO planning is: (1) neonpanel_listInventoryItems, (2) supply_chain_inspect_inventory_sku_snapshot, (3) supply_chain_list_product_logistics_parameters, (4) supply_chain_list_po_placement_candidates.
- When a tool returns empty results, never re-run the same tool with the same parameters. Switch to the Empty Results Diagnosis skill to identify the root cause.
- PO recommendations must include five sections: Current Inventory, Sales Forecast, Risk Assessment, PO Recommendation, and Next Steps.
- Days of supply must be calculated two ways: FBA-only (available stock ÷ daily velocity) and with inbound (available + inbound ÷ daily velocity).
- Safety stock calculations use class-based multipliers (e.g., Class A items use a 1.2x multiplier on base safety stock days).
- When presenting PO recommendations, always state a clear recommendation with rationale. Never end with 'Option 1 or Option 2?' without providing a recommended choice.
- The agent cannot change forecast scenarios directly — scenario changes must be made by the user in NeonPanel.
- A forecast scenario mismatch must be reported with impact analysis before proceeding. The user must choose: wait to apply the correct scenario, or proceed with the current one.
- Data validation results must use clear status indicators: ✅ for confirmed, ❌ for missing/failed, ⚠️ for using defaults or requiring attention.
- Escalation is required when: data exists in one system but not another, no lead time AND no company default exists, the same tool query returns different results on retry, or multiple valid PO quantities exist with significantly different trade-offs.
- PO cadence defines how frequently purchase orders are placed and affects recommended PO timing and quantity calculations.
- When multiple SKUs exist under a parent ASIN, each SKU must be validated independently — they may have different forecast scenarios, lead times, and safety stock configurations.
- When the user provides a parent ASIN, trust their input immediately — do not run validation calls to neonpanel_listInventoryItems to confirm it. Go straight to the supply chain analysis tools.
- The supply chain tools (supply_chain_analyze_sales_velocity, supply_chain_list_po_placement_candidates, supply_chain_inspect_inventory_sku_snapshot) are parent-ASIN-aware. Pass the parent ASIN directly using the parent_asin parameter — these tools return all child SKUs automatically.
- Never pre-resolve a parent ASIN to child ASINs manually. Let the supply chain tools handle parent-to-child resolution — that is what they are built for.
- When the user provides an additional ASIN mid-conversation, immediately add it to the parent_asin filter array — do not treat it as a separate lookup requiring new validation.
- Product family (product_family field) is more reliable than parent ASIN for finding all variants because: (1) it is manually curated by the team, not dependent on Amazon catalog sync, (2) parent ASIN mappings can be stale, null, or missing for new variants, and (3) product family catches cross-parent items if ASINs are split or merged.
- When analyzing a product family, always use the two-step lookup: first query by parent_asin to find initial items, then identify the product_family from those results and re-query by product_family to catch any orphaned variants with null or mismatched parent ASIN mappings.
- Any variant found via product_family lookup that has a null or mismatched parent_asin should be flagged to the user as a data integrity issue requiring catalog correction.
- When a parent ASIN query returns fewer SKUs than expected, always cross-check by product_family before concluding the family is complete.
