# Amazon Listing Audit — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- The Amazon Listing Audit has 10 phases: Phases 1-6 are data collection, Phases 7-10 are strategic analysis.
- Phase 1 (Product Intelligence): scrape target listing, competitor listings, reviews, and SERP snapshot using BrightData.
- Phase 2 (SQP): pull Search Query Performance data — keyword funnel metrics, click share, conversion share — and identify cannibalization between own ASINs.
- Phase 3 (SCP): pull Search Catalog Performance data, identify underperforming variations, calculate catalog-level KPIs.
- Phase 4 (Competitive Landscape): pull competitor listings, pricing, review data via BrightData; run head-to-head comparison and search term momentum analysis.
- Phase 5 (PPC/Advertising): pull search term report, campaign structure, ACOS; identify high-spend low-conversion terms and optimization opportunities.
- Phase 6 (Cross-sell & Repeat): analyze market basket data, repeat purchase patterns, bundle opportunities, and Subscribe & Save potential.
- Phase 7 (Content Deep Audit): audit title, bullets, description, A+ Content, image stack, video, and Rufus/AI readiness against competitors.
- Phase 8 (Synthesis & Diagnosis): synthesize findings across all phases, apply traffic diagnosis framework, categorize issues by type (content, keyword, competitive, conversion, advertising).
- Phase 9 (Action Plan): score each action using Impact × Ease × Revenue Exposure (max 125), tier actions (Tier 1: 80+, Tier 2: 40-79, Tier 3: <40), apply 30-day decision framework.
- Phase 10 (Baseline Measurement): capture current BSR, keyword rankings, conversion rate, sessions, revenue; define 30-day measurement plan with check-in dates.
- All data collection phases (1-6) must be completed and saved to Supabase before starting strategic analysis phases (7-10).
- Action scoring uses the formula: Impact × Ease × Revenue Exposure, with a maximum score of 125.
- There are 17 critical audit rules that govern how data is interpreted and recommendations are made.
- Signal quality tags must be applied to low-data keywords — do not treat low-confidence signals the same as high-confidence ones.
- Phase results must be saved to Supabase before ending any session — unsaved data is lost.
- Audit data is stored in Supabase tables: audit_runs, phase_results, audit_findings, audit_actions, and audit_baselines.
- The start_audit() function creates a new audit run, and initialize_audit_phases() sets up the phase tracking structure.
- When a Supabase query returns empty results or fails, follow the Supabase Query Fallback Procedure — never retry the same failing query more than twice total.
- Before querying any Supabase table, first call list_tables to confirm the table exists and verify the exact table name.
- If both Supabase query attempts fail, clearly state the specific technical finding and offer concrete alternatives (check different table, check Supabase dashboard, or paste data directly).
- Parallel execution is supported: multiple chats can run different data collection phases simultaneously, but all must save to the same audit_run_id.
- The 30-day decision framework defines check-in points for measuring the impact of implemented audit actions.
