# Diagnose Lost Batches Cogs — Module Map

## lost-batches-fundamentals

Core concepts: what lost batches are (FIFO engine couldn't assign a source batch for outbound units), what lost COGS is (lost batches specifically on invoice/sale transactions resulting in $0 COGS), why FIFO is per-warehouse, and how same-date transaction priority works. All lost COGS are lost batches, but not all lost batches are lost COGS.

**Common user intents:**
- What are lost batches?
- What is lost COGS?
- Why do I have $0 COGS?
- How does FIFO work per warehouse?
- What's the difference between lost batches and lost COGS?

**Common confusions:**
- Confusing lost batches with lost COGS — all lost COGS are lost batches but not vice versa
- Assuming company-wide stock covers warehouse-specific FIFO — FIFO is per-warehouse
- Not understanding same-date transaction priority — outbound processes before inbound on the same date
- Thinking lost batches mean inventory is physically lost — it means the FIFO engine couldn't find a source batch to assign

**Key objects:** lost batch, lost COGS, FIFO queue, outbound transaction, invoice, shipment, warehouse, same-date priority, Lost & Found warehouse

## cogs-triage

Phase 1 of the diagnostic skill: assessing overall COGS quality, identifying the worst offenders by SKU/brand/company, and applying the Warehouse Fork — the critical first diagnostic signal that determines the nature of the problem. The Warehouse Fork classifies problems into two categories: Physical Gap (warehouse = Lost & Found, stock never arrived in the selling warehouse ledger) or Cost/Identity Gap (warehouse = actual location, stock exists but FIFO engine cannot see it due to $0 cost or wrong identity).

**Common user intents:**
- I have lost COGS
- My COGS quality is bad
- Sales have $0 cost
- Check my COGS quality
- Which SKUs have the worst COGS?

**Common confusions:**
- Not checking the warehouse on the transaction first — jumping straight to tracing backwards without the fork
- Assuming all lost COGS means stock never arrived — it may have arrived with $0 cost
- Starting with individual SKUs instead of the aggregate view

**Artifacts to request:**
- Scope: specific SKU, brand, or entire company
- Time period of concern
- Investigation threshold (minimum units or dollars)

**Key objects:** COGS Quality tab, Lost COGS entry, Warehouse Fork, Physical Gap (Lost & Found warehouse), Cost or Identity Gap (actual warehouse with $0 cost), COGS quality percentage, Investigation threshold, cogs_analyze_fifo_cogs tool (analysis_mode: lost_cogs)

## lost-batch-investigation

Phase 2 of the diagnostic skill: the aggregate-first investigation approach for all lost batches. Uses cogs_list_lost_batches to pull ALL lost batches across all transaction types (invoices, shipments, adjustments). Starts with the big picture (shipment-level and PO-level patterns), then drills into individual SKUs. For each SKU, analyzes surrounding transactions — Lost & Found activity, origin/destination warehouses, backwards timeline (POs, earlier problems, date ordering), forwards timeline (subsequent shipments, delayed arrivals), warehouse ID verification, volume anomalies, and onboarding residue.

**Common user intents:**
- I have lost batches
- Trace why this batch is lost
- Find the root cause of lost batches
- Which shipments are causing the most lost batches?
- Why is stock missing from this warehouse?

**Common confusions:**
- Starting with individual SKUs instead of aggregate patterns — one shipment can cause lost batches across many SKUs
- Only looking at the lost batch itself without examining surrounding transactions
- Not checking for same-date transaction priority issues
- Confusing AWD with Amazon FBA warehouses
- Using cogs_analyze_fifo_cogs (lost_batches mode) instead of cogs_list_lost_batches — the former only covers invoice/sale transactions, the latter covers ALL transaction types including shipments

**Artifacts to request:**
- SKU or inventory ID to investigate
- Date range of lost batches
- Which warehouses are involved

**Key objects:** Lost Batches tab, Aggregate view (by shipment/PO pattern), Surrounding transactions, Date ordering (same-date priority, different-date variant), Volume anomalies, Statement Analytics report, cogs_list_lost_batches tool

## diagnostic-discipline

Behavioral guardrails for the diagnostic process: the guide-don't-prescribe principle (surface data and explain mechanics, but let the user make the final call on fixes), the exception for unambiguous cases, the hard limit (cannot detect absence of data never entered), and escalation rules for locked periods, systematic issues, and bulk operations.

**Common user intents:**
- What should I do to fix this?
- Can you just fix it?
- Why can't you tell me what's missing?
- Should I recalculate?

**Common confusions:**
- Expecting the agent to prescribe fixes without sufficient evidence
- Thinking recalculation always fixes lost batches — locked periods prevent it
- Assuming the system can detect data that was never entered

**Key objects:** Guide vs. prescribe boundary, Unambiguous evidence exception, Hard limit (missing data never entered), Locked period constraint, Escalation triggers

## tools-and-reports

Reference mapping of which NeonPanel tools and reports to use at each stage of the diagnostic process. Phase 1 uses cogs_analyze_fifo_cogs (lost_cogs mode) for COGS quality assessment. Phase 2 uses cogs_list_lost_batches for comprehensive lost batch investigation across ALL transaction types including shipments. Per-SKU deep dives use neonpanel_getInventoryCogs and neonpanel_getInventoryDetails. Also covers Statement Analytics for Amazon anomalies, Landed Cost Analysis for verifying whether PO value made it into the warehouse ledger, Inventory Audit for comparing computed ledger balance against Warehouse Balances view, and search_neonpanel_project_url for finding specific documents.

**Common user intents:**
- Which report should I look at?
- How do I pull lost batch data?
- Where do I check for Amazon adjustments?
- How do I verify costs?
- Which tool for lost COGS vs lost batches?
- How do I verify if PO value landed in the warehouse?

**Common confusions:**
- Using cogs_analyze_fifo_cogs (lost_batches mode) for comprehensive lost batch investigation — this only covers invoice/sale transactions. Use cogs_list_lost_batches instead for all transaction types.
- Not knowing Statement Analytics exists for Amazon anomaly investigation
- Confusing the Landed Cost Analysis report with shipment-level landed cost
- Not understanding that cogs_list_lost_batches captures shipment-level lost batches that cogs_analyze_fifo_cogs does not surface

**Key objects:** FIFO Transactions report (COGS Quality tab, Lost Batches tab, Transaction List), cogs_analyze_fifo_cogs tool (lost_cogs mode — Phase 1), cogs_list_lost_batches tool (Phase 2 — all transaction types), neonpanel_getInventoryCogs (per-SKU COGS deep dive), neonpanel_getInventoryDetails (per-SKU transaction history), Statement Analytics report, Landed Cost Analysis report, Inventory Audit report, Warehouse Balances view, search_neonpanel_project_url tool
