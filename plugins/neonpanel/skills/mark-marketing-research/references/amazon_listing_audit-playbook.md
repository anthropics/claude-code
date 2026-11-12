# Amazon Listing Audit — Playbook

# Amazon Listing Audit Playbooks

## Start a New Listing Audit

1. Confirm the target ASIN and marketplace with the user.
2. Call `start_audit()` in Supabase to create a new audit_run record.
3. Call `initialize_audit_phases()` to set up phase tracking for all 10 phases.
4. Confirm the audit_run_id with the user for reference.
5. Begin Phase 1: Product Intelligence data collection.

## Phase 1 — Product Intelligence

1. Use BrightData to scrape the target listing (product details, images, bullets, A+ content).
2. Scrape competitor listings identified from search results (top 3-5).
3. Pull review data for the target ASIN and competitors for sentiment analysis.
4. Run a SERP snapshot for the primary keyword.
5. Save all results to phase_results in Supabase with the audit_run_id.

## Phase 2 — Search Query Performance (SQP)

1. Confirm the user has Brand Analytics access.
2. Pull SQP data: keyword funnel metrics, click share, conversion share.
3. Identify cannibalization between the user's own ASINs.
4. Build the SQP signal dashboard.
5. Save results to phase_results in Supabase.

## Phase 3 — Search Catalog Performance (SCP)

1. Pull Search Catalog Performance data for the target ASIN (and variations if applicable).
2. Identify problem child ASINs (underperforming variations).
3. Calculate catalog-level KPIs.
4. Save results to phase_results in Supabase.

## Phase 4 — Competitive Landscape

1. Identify top 3-5 competitors with the user.
2. Use BrightData to pull competitor listings, pricing, and review data.
3. Run head-to-head comparison on key metrics.
4. Analyze search term momentum — who's gaining/losing share.
5. Save competitive data to phase_results in Supabase.

## Phase 5 — PPC/Advertising Analysis

1. Confirm PPC data access with the user.
2. Pull search term report, campaign structure, and ACOS data.
3. Identify high-spend low-conversion terms.
4. Analyze campaign structure for optimization opportunities.
5. Save results to phase_results in Supabase.

## Phase 6 — Cross-sell & Repeat Purchase

1. Analyze market basket data for cross-sell opportunities.
2. Check repeat purchase patterns.
3. Evaluate bundle opportunities (Virtual Bundles, Frequently Bought Together).
4. Assess Subscribe & Save potential.
5. Save results to phase_results in Supabase.

## Phase 7 — Content Deep Audit

1. Verify all data collection phases (1-6) are complete in Supabase.
2. Audit listing content against competitors: title, bullets, description, A+ Content.
3. Audit image stack: hero image, lifestyle, infographic, video.
4. Assess Rufus/AI readiness — is the listing structured for AI comprehension?
5. Score content gaps and generate the content audit report.
6. Save results to phase_results in Supabase.

## Phase 8 — Synthesis & Diagnosis

1. Verify phases 1-7 are complete.
2. Synthesize findings across all phases into a unified diagnosis.
3. Apply the traffic diagnosis framework to identify root causes.
4. Categorize issues by type: content, keyword, competitive, conversion, advertising.
5. Generate the synthesis report with clear cause-effect chains.

## Phase 9 — Prioritized Action Plan

1. List all recommended actions from the synthesis.
2. Score each action using Impact × Ease × Revenue Exposure (max 125).
3. Tier actions: Tier 1 (score 80+, do immediately), Tier 2 (40-79, schedule soon), Tier 3 (<40, backlog).
4. Apply the 30-day decision framework — assign actions to specific weeks.
5. Present the prioritized action plan with expected outcomes.

## Phase 10 — Baseline Measurement

1. Capture current baselines: BSR, keyword rankings, conversion rate, sessions, revenue.
2. Define the 30-day measurement plan with specific check-in dates (Day 7, 14, 21, 30).
3. Set up tracking for key metrics.
4. Save baselines to audit_baselines in Supabase.

## Resume a Failed Audit

1. Get the audit_run_id from the user.
2. Check audit_progress view in Supabase to see completed vs pending phases.
3. Identify the last successfully completed phase.
4. Resume from the next incomplete phase.
5. If data was lost, re-run only the affected phase — do not restart the entire audit.

## Supabase Query Fallback Procedure

This procedure is MANDATORY whenever querying Supabase for any audit data.

1. **Verify table existence**: Call `list_tables` to confirm the target table exists (exact name, case-sensitive). If the table does NOT exist, stop immediately and tell the user.
2. **First query attempt**: Write a targeted SQL query with explicit column names (avoid SELECT *). Use LIMIT 10 unless all rows are needed. Execute via `execute_sql`.
3. **If first attempt fails or returns empty**: Run a diagnostic query — `SELECT count(*) FROM table_name;` and `SELECT * FROM table_name LIMIT 5;` to understand why.
4. **Second query attempt**: Based on diagnostic findings, adjust the query (fix column names, broaden WHERE clause, try different filter column). Execute.
5. **If both attempts fail — STOP**: Do not attempt a third query. State the specific technical finding clearly (e.g., "table exists but is empty" or "no rows match criteria"). Offer alternatives: check a different table, check Supabase dashboard directly, or paste the data.