# Po Planning Workflow — Module Map

## intake-clarification

Phase 1 of PO planning: collecting all required inputs (identifier type, forecast scenario, planning parameters, scope) in a single structured request before making any tool calls.

**Common user intents:**
- Plan POs for company X
- Let's do replenishment planning
- I need to place a purchase order

**Common confusions:**
- Assuming a parent ASIN is a single SKU
- Not specifying which forecast scenario to use
- Expecting the agent to know default parameters without checking

**Artifacts to request:**
- Company ID
- Product identifier (ASIN, SKU, or family name)
- Forecast scenario name
- Marketplace

**Key objects:** Identifier (parent ASIN, child ASIN, SKU, product family), Forecast scenario, Lead time days, Safety stock days, PO cadence, Planning horizon, Marketplace, SKU scope

## data-validation

Phase 2 of PO planning: validating all inputs exist and are correctly configured before running analysis tools. Checks SKU existence, scenario assignment, lead time, and safety stock.

**Common user intents:**
- Check if my data is ready for planning
- Validate these inputs
- Why did the tool return empty?

**Common confusions:**
- Skipping validation and going straight to analysis
- Assuming company defaults always exist
- Not checking each SKU independently in multi-SKU families

**Key objects:** Validation report, Status indicators (✅ ❌ ⚠️), Company access, SKU existence, Scenario assignment, Lead time config, Safety stock config

## tool-sequencing

Phase 3 of PO planning: executing tools in the correct order — (1) listInventoryItems, (2) inspect_inventory_sku_snapshot, (3) list_product_logistics_parameters, (4) list_po_placement_candidates.

**Common user intents:**
- Run the PO analysis
- Get PO recommendations
- What tools do I need for planning?

**Common confusions:**
- Running PO placement before getting inventory snapshot
- Skipping logistics parameters check
- Re-running the same tool with same params when it returns empty

**Key objects:** neonpanel_listInventoryItems, supply_chain_inspect_inventory_sku_snapshot, supply_chain_list_product_logistics_parameters, supply_chain_list_po_placement_candidates

## result-presentation

Phase 5 of PO planning: presenting results in a structured 5-section format — Current Inventory, Sales Forecast, Risk Assessment, PO Recommendation, and Next Steps.

**Common user intents:**
- Show me the PO recommendation
- What should I order?
- Give me the analysis

**Common confusions:**
- Presenting raw tool output without structure
- Ending with 'Option 1 or 2?' without a recommendation
- Not calculating days of supply both ways (FBA-only and with inbound)

**Key objects:** Current Inventory section, Sales Forecast section, Risk Assessment section, PO Recommendation section, Next Steps checklist, Days of supply, Safety stock multiplier

## scenario-mismatch-handling

Phase 6 of PO planning: detecting and handling forecast scenario mismatches — when the user requests a specific scenario but the SKU is assigned a different one.

**Common user intents:**
- Use this forecast scenario
- Why is it using the wrong scenario?
- Switch to promo scenario

**Common confusions:**
- Thinking the agent can change scenarios directly
- Ignoring the mismatch and proceeding with wrong scenario
- Not explaining the impact difference between scenarios

**Key objects:** Current scenario, Requested scenario, Impact analysis, NeonPanel scenario change steps, Re-run trigger

## escalation-criteria

Phase 7 of PO planning: knowing when to escalate — data integrity issues, missing critical configuration, unexpected tool results, or user decisions required.

**Common user intents:**
- Something isn't working
- The data looks wrong
- I need help deciding

**Common confusions:**
- Asking vague follow-ups instead of escalating
- Not summarizing findings before escalating
- Escalating too early without running diagnostics

**Key objects:** Data integrity issue, Missing critical config, Unexpected tool results, User decision required, Escalation summary format
