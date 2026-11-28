# Po Planning Workflow — Playbook

# PO Planning Workflow Playbooks

## Phase 1: Intake & Clarification

1. When a user says "plan POs for company X, marketplace Y, product Z", immediately ask for ALL of the following in a single structured request:
2. **Identifier clarity**: Is the identifier a parent ASIN, child ASIN, SKU, or product family code? If parent ASIN, confirm it — do NOT ask for child ASINs (the supply chain tools resolve children automatically).
3. **Forecast scenario**: Which scenario to use? (e.g., "promo_shift_128_growth_v2", default, or current?) Is it already created in NeonPanel?
4. **Planning parameters**: Lead time days, safety stock days, PO cadence, planning horizon (30/60/90 days) — or confirm using company defaults.
5. **Scope**: All SKUs in this family, or specific ones? Which marketplace?
6. Do NOT make any tool calls until all four categories are confirmed.
7. If the user provides partial info, ask for the remaining items in one follow-up — never spread across multiple exchanges.

## Phase 2: Data Validation

1. Once inputs are confirmed, validate each before running analysis tools.
2. Check company exists and user has access.
3. **If user provided a parent ASIN**: Trust their input. Do NOT call `neonpanel_listInventoryItems` to validate it. Go directly to the supply chain tools in Phase 3 — they accept `parent_asin` as a parameter and resolve all children automatically.
4. **If user provided a SKU or child ASIN**: Confirm it exists using `neonpanel_listInventoryItems`.
5. Check forecast scenario assignment using `supply_chain_inspect_inventory_sku_snapshot`.
6. Check lead time and safety stock using `supply_chain_list_product_logistics_parameters`.
7. **Two-step family completeness check**: After the initial parent ASIN query returns results, identify the `product_family` value from those results (e.g., "Bumpers - Mix"). Re-query by `product_family` + `marketplace` to catch any orphaned variants whose `parent_asin` field is null or mismatched. If the product_family query returns more SKUs than the parent ASIN query, flag the extras as data integrity issues (missing parent ASIN mapping).
8. Report findings with clear status indicators:
   - ✅ Found 3 SKUs under parent ASIN B0D45BYWQR
   - ⚠️ Found 2 additional SKUs via product family "Bumpers - Mix" with null parent ASIN — flagged for catalog fix
   - ❌ Scenario "promo_shift_128_growth_v2" not assigned to SKU VLX-SLCNPDS-104-MIX-VLX
   - ⚠️ Lead time not set; using company default (30 days)
9. If any check returns ❌, STOP and report the issue. Do not proceed to tool execution with unresolved failures.
10. For multi-SKU families, validate each SKU independently.

## Phase 3: Tool Sequencing

1. Execute tools in this order — adapting based on identifier type:

**If parent ASIN provided (preferred path):**
   - Step 1: `supply_chain_inspect_inventory_sku_snapshot` with `parent_asin: ["B0D45BYWQR"]` — Returns all child SKUs with inventory + forecast data
   - Step 1b: Identify `product_family` from Step 1 results. Re-query with `product_family` filter to catch orphaned variants with null parent ASIN. Merge results.
   - Step 2: `supply_chain_analyze_sales_velocity` with `parent_asin: ["B0D45BYWQR"]` — Returns velocity data for all children
   - Step 3: `supply_chain_list_product_logistics_parameters` — Get lead time, MOQ, vendor info per SKU
   - Step 4: `supply_chain_list_po_placement_candidates` with `parent_asin: ["B0D45BYWQR"]` — Get PO recommendations for all children

**If SKU/child ASIN provided:**
   - Step 1: `neonpanel_listInventoryItems` — Confirm SKU exists
   - Step 2: `supply_chain_inspect_inventory_sku_snapshot` — Get inventory + forecast
   - Step 3: `supply_chain_list_product_logistics_parameters` — Get lead time, MOQ, vendor info
   - Step 4: `supply_chain_list_po_placement_candidates` — Get PO recommendations

2. **When user provides an additional ASIN mid-conversation**: Add it to the `parent_asin` array immediately (e.g., `parent_asin: ["B0D45BYWQR", "B0FGQH688S"]`). Do NOT treat it as a separate lookup.
3. If Step 4 returns empty results, do NOT re-run it. Switch to the **Empty Results Diagnosis** skill.
4. Collect results from all steps before presenting to the user.
5. If any step fails with an error (not empty, but error), retry once. If it fails again, escalate.

## Phase 4: Result Presentation

1. Present results in exactly 5 sections using this template:

```
📊 PO PLANNING ANALYSIS: [SKU] ([Child ASIN])
Company [ID] | [Marketplace] Market | Parent ASIN: [Parent]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ CURRENT INVENTORY (as of [date])
   Available (FBA):        [X] units
   Inbound (FBA):          [X] units
   Warehouse stock:        [X] units
   WIP orders:             [X] units ([PO reference])
   ─────────────────────────────────
   Total coverage:         [X] units

2️⃣ SALES FORECAST (Using: [scenario name])
   Current velocity:       [X] u/day ([period] avg)
   Peak velocity:          [X] u/day ([month])
   Next 30 days:          ~[X] units
   Next 60 days:          ~[X] units

3️⃣ RISK ASSESSMENT
   [⚠️/✅] Days of supply (FBA only):     [X] days
   [⚠️/✅] Days of supply (with inbound): [X] days
   Status: [CRITICAL/AT RISK/HEALTHY] ([explanation])

4️⃣ PO RECOMMENDATION
   Recommended quantity:   [X]–[Y] units
   Recommended timing:     Place by [date] ([lead time]-day lead time)
   Arrival window:         [date range]
   Rationale:
   - [Demand coverage explanation]
   - [Safety stock calculation with class multiplier]
   - [PO cadence alignment]

5️⃣ NEXT STEPS
   ☐ [Action item 1]
   ☐ [Action item 2]
   ☐ [Action item 3]
   ☐ (Optional) [Action item 4]
```

2. Always state a clear recommendation — never end with "Option 1 or Option 2?" without recommending one.
3. Calculate days of supply two ways: FBA-only AND with all inbound.
4. Include the safety stock class multiplier in the rationale (e.g., "Class A: 1.2x").
5. Show every product variant individually in its own row. Never collapse SKUs into combined columns or "other" buckets without explicit user permission.
6. State how many variants were found (including any discovered via product family cross-check) and ask the user to confirm the count before proceeding.

## Phase 5: Forecast Scenario Mismatch Handling

1. When the user requests a specific scenario but the SKU is using a different one, report the mismatch immediately:

```
🔄 FORECAST SCENARIO MISMATCH DETECTED

Current scenario:   [Current scenario name] (scenario [ID])
Requested scenario: [Requested scenario name]

Impact on PO planning:
- Current forecast: [X] units in [month] → PO of ~[Y] units
- Requested scenario: [UNKNOWN — need to apply it first]
```

2. Provide step-by-step NeonPanel instructions:
   - Go to NeonPanel → Inventory Planning
   - Select SKU [SKU code]
   - Change forecast scenario to [requested scenario]
   - Save and refresh
3. Ask: "Want me to wait for you to apply the scenario, or proceed with the current forecast?"
4. If user chooses to wait, confirm when they're ready and re-run from Phase 3 (tool execution).
5. If user chooses to proceed, clearly disclose which scenario is being used in the result presentation.

## Phase 6: Escalation

1. Escalate when any of these conditions are met:
   - **Data integrity**: SKU exists in one system but not another
   - **Missing critical config**: No lead time AND no company default
   - **Unexpected results**: Same tool query returns different results on retry, or tool returns data with null/zero values for key fields
   - **User decision required**: Multiple valid PO quantities with different trade-offs, or conflicting parameters
   - **Orphaned variants**: Product family cross-check reveals SKUs with null parent ASIN — flag as catalog data integrity issue
2. When escalating, always:
   - Summarize all findings collected so far
   - Explain the specific gap or issue
   - Present options with trade-offs:
     "This requires a decision from you. Should I: A) [Option with trade-offs] B) [Option with trade-offs] Or escalate to [specialist]?"
3. Never ask vague follow-up questions instead of escalating.
4. Never escalate without first running the diagnostic tree (if applicable).