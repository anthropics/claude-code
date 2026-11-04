# Inventory Validation — Playbook

# Inventory Validation Playbooks

## SKU Identifier Resolution

1. Determine the identifier type: parent ASIN, child ASIN, SKU code, or product family name.
2. Confirm the marketplace (US, UK, EU, etc.) and company ID.
3. **If parent ASIN**: Do NOT call `neonpanel_listInventoryItems` to pre-resolve children. Trust the user's input and go directly to the supply chain tools, which accept `parent_asin` as a parameter and resolve all children automatically.
   - Use `supply_chain_inspect_inventory_sku_snapshot` with `parent_asin: ["B0D45BYWQR"]`
   - Use `supply_chain_list_po_placement_candidates` with `parent_asin: ["B0D45BYWQR"]`
   - Use `supply_chain_analyze_sales_velocity` with `parent_asin: ["B0D45BYWQR"]`
   - These tools return all child ASINs/SKUs automatically.
4. **Two-step family completeness check (mandatory for parent ASIN lookups)**:
   - After the initial parent ASIN query returns results, identify the `product_family` value from those results (e.g., "Bumpers - Mix").
   - Re-query by `product_family` + `marketplace` to catch any orphaned variants whose `parent_asin` field is null or mismatched.
   - If the product_family query returns more SKUs than the parent ASIN query, flag the extras:
     ```
     ⚠️ ORPHANED VARIANTS DETECTED
     Found via product family "Bumpers - Mix" but missing parent ASIN mapping:
     - SKU: [sku_code] (child ASIN: B0FGQH688S) — parent_asin is NULL
     Action: Fix parent ASIN mapping in catalog for complete family coverage.
     ```
   - Include the orphaned variants in the analysis — do not exclude them just because parent ASIN is null.
5. **If child ASIN or SKU code**: Run `neonpanel_listInventoryItems` to confirm it exists in the company and marketplace.
6. **If product family name**: Run `neonpanel_listInventoryItems` with search_query to find matching SKUs, then confirm with user.
7. **When user provides an additional ASIN mid-conversation**: Add it to the existing `parent_asin` array immediately (e.g., `parent_asin: ["B0D45BYWQR", "B0FGQH688S"]`). Do NOT start a new validation flow or treat it as a separate lookup.
8. If no results found from supply chain tools: check marketplace, try alternate identifier formats, check active vs. archived.
9. If the same SKU exists in multiple marketplaces, flag this and confirm which marketplace to use.

## Planning Configuration Verification

1. For each SKU in scope (including any orphaned variants found via product family cross-check), check these four configuration items:
2. **Lead time**: Run `supply_chain_list_product_logistics_parameters`. Check for SKU-level lead_time_days. If not set, check company default.
3. **Safety stock**: Check safety_stock_days from same tool. Note the item class and applicable multiplier (e.g., Class A: 1.2x).
4. **Forecast scenario**: Run `supply_chain_inspect_inventory_sku_snapshot`. Check which scenario is assigned. Compare to user's requested scenario.
5. **Planning status**: Check if SKU is flagged as actively sold / included in planning_base.
6. Report results per SKU with status indicators:
   ```
   SKU: VLX-SLCNPDS-104-MIX-VLX
   ✅ Lead time: 60 days (SKU-level)
   ✅ Safety stock: 14 days (company default, Class A: 1.2x = 16.8 effective)
   ❌ Forecast scenario: Using 'Recency-Weighted Conservative', not 'promo_shift_128_growth_v2'
   ✅ Planning status: Actively sold
   ⚠️ Parent ASIN: NULL — found via product family cross-check only
   ```
7. If any SKU has ❌ items, flag it as not ready for planning and provide resolution steps.

## Warehouse Clone Detection

1. Run `neonpanel_listWarehouses` for the company.
2. Group warehouses by name.
3. If any name appears more than once with different IDs, flag as potential clone:
   ```
   ⚠️ WAREHOUSE CLONE DETECTED
   Name: "Amazon FBA US"
   - ID: wh_001 (type: FBA, status: active)
   - ID: wh_047 (type: FBA, status: active)
   These may cause inventory data to split across two entities.
   Action: Verify which ID is correct in your shipments and inventory data.
   ```
4. Identify all AWD warehouses and flag them:
   ```
   ℹ️ AWD Warehouses (inventory NOT available for FBA sale):
   - "Amazon AWD US" (ID: wh_012)
   Inventory here must be shipped to FBA before it becomes sellable.
   ```
5. List warehouse types for reference: FBA, AWD, 3PL, own.

## Inventory Position Analysis

1. For each validated SKU (including orphaned variants found via product family), compile the full inventory position:
2. **FBA Available**: Current sellable stock in FBA warehouses.
3. **Inbound**: Units in transit to FBA (from shipments not yet received).
4. **Warehouse Stock**: Units in own/3PL warehouses (not yet shipped to FBA).
5. **WIP Orders**: Purchase orders placed but not yet received (include PO reference numbers).
6. Calculate total coverage = FBA Available + Inbound + Warehouse Stock + WIP.
7. Calculate days of supply two ways:
   - FBA-only: Available ÷ daily velocity
   - With inbound: (Available + Inbound) ÷ daily velocity
8. Apply risk thresholds:
   - 🔴 CRITICAL: FBA-only < 7 days
   - 🟡 AT RISK: FBA-only < 14 days
   - 🟢 HEALTHY: FBA-only ≥ 14 days AND with-inbound ≥ 30 days
9. Note: WIP orders should NOT be counted as available stock but are part of total coverage for planning purposes.