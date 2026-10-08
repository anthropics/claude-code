# Empty Results Diagnosis — Playbook

# Empty Results Diagnosis Playbooks

## 5-Check Diagnostic Tree

When a planning tool (especially `supply_chain_list_po_placement_candidates`) returns empty results, follow these 5 checks in strict order. Do NOT skip checks or re-run the original tool.

### Check 1: Does the SKU exist in the snapshot?

1. Run `supply_chain_inspect_inventory_sku_snapshot` for the SKU.
2. If the SKU is found → proceed to Check 2.
3. If the SKU is NOT found → report:
   ```
   ❌ SKU not found in company [ID] ([marketplace]).
   Possible reasons:
   - Not set up in NeonPanel yet
   - Set up for a different marketplace (check UK, EU, etc.)
   - Inactive/archived
   - Spelling or format mismatch
   Action: Confirm SKU code and marketplace, then check NeonPanel inventory list.
   ```
4. Use `neonpanel_listInventoryItems` to search for similar identifiers if the exact match fails.

### Check 2: Does it have lead_time_days configured?

1. Run `supply_chain_list_product_logistics_parameters` for the SKU.
2. If lead_time_days is set → proceed to Check 3.
3. If lead_time_days is NOT set → check for company default.
4. If company default exists → report:
   ```
   ⚠️ Lead time not set for this SKU.
   Company default: [X] days.
   Action: Set lead_time_days in NeonPanel for this SKU, or confirm using company default.
   ```
5. If NO company default → report:
   ```
   ❌ Lead time not set for this SKU AND no company default exists.
   This is a critical configuration gap — PO planning cannot proceed.
   Action: Go to NeonPanel → Company Settings → Supply Chain → Set lead_time_days.
   ```

### Check 3: Does it have safety_stock_days configured?

1. Check safety_stock_days from the logistics parameters.
2. If set → proceed to Check 4.
3. If NOT set → check for company default.
4. Report with class multiplier info if applicable:
   ```
   ⚠️ Safety stock not set for this SKU.
   Company default: [X] days (Class A: 1.2x multiplier = [Y] effective days).
   Action: Set safety_stock_days in NeonPanel or confirm using default.
   ```

### Check 4: Is it using the correct forecast scenario?

1. Check the scenario assignment from the inventory snapshot.
2. If the assigned scenario matches the user's requested scenario → proceed to Check 5.
3. If there's a mismatch → report:
   ```
   ❌ SKU is using '[current scenario]' (scenario [ID]),
   not '[requested scenario]'.
   Action: Apply [requested scenario] in NeonPanel:
   1. Go to Inventory Planning
   2. Select SKU [code]
   3. Change forecast scenario
   4. Save and refresh
   Then I'll re-run the PO analysis.
   ```

### Check 5: Is it flagged as "actively sold" or "planned"?

1. Check the planning_base status for the SKU.
2. If flagged as actively sold → report:
   ```
   ✅ All 5 checks pass. Tool returned empty for unknown reason.
   Escalating to support with diagnostic summary.
   ```
3. If NOT flagged → report:
   ```
   ❌ SKU not flagged for PO planning.
   Current planning_base: [value]
   Action: Set planning_base to 'actively_sold_only' or 'all' in NeonPanel.
   ```

## Post-Fix Verification

1. After the user reports they've made a configuration change, re-run ONLY the specific check that failed.
2. If the check now passes, offer to re-run the full PO planning workflow from Phase 3 (tool execution).
3. If the check still fails, report the persistent issue and escalate.
4. Do NOT re-run all 5 checks — only verify the one that was fixed.