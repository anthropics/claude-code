# Amazon Listing Audit — Module Map

## audit-phases-data-collection

Phases 1-6 of the listing audit: Product Intelligence (scrape listing, reviews, competitors, SERP), SQP analysis, SCP analysis, Competitive Landscape, PPC/Advertising analysis, and Cross-sell/Repeat Purchase analysis. Each phase collects raw data and saves to Supabase.

**Common user intents:**
- Run a specific data collection phase
- What tools does each phase use?
- Start a new listing audit
- What data do I need to collect?

**Common confusions:**
- Analyzing data during collection phases — collect first, analyze later
- Skipping phases and trying to run analysis with incomplete data

**Artifacts to request:**
- Target ASIN
- Marketplace (US, UK, DE, etc.)
- Primary keywords
- Top 3-5 competitor ASINs

**Key objects:** Phase 1: Product Intelligence, Phase 2: SQP, Phase 3: SCP, Phase 4: Competitive Landscape, Phase 5: PPC/Advertising, Phase 6: Cross-sell & Repeat, phase_results table, BrightData scraping

## audit-phases-strategic-analysis

Phases 7-10 of the listing audit: Content Deep Audit (title, bullets, A+, images, video, Rufus/AI readiness), Synthesis & Diagnosis (cross-phase findings, traffic diagnosis framework), Prioritized Action Plan (Impact × Ease × Revenue Exposure scoring, tiering), and Baseline Measurement (BSR, rankings, conversion, sessions, revenue tracking).

**Common user intents:**
- Run strategic analysis on collected data
- Generate an action plan
- What's the diagnosis framework?
- How do I score and prioritize actions?

**Common confusions:**
- Running analysis without complete data collection from phases 1-6
- Skipping synthesis and jumping straight to action plan

**Artifacts to request:**
- Completed phase_results from phases 1-6

**Key objects:** Phase 7: Content Deep Audit, Phase 8: Synthesis & Diagnosis, Phase 9: Action Plan, Phase 10: Baseline Measurement, Traffic diagnosis framework, Action scoring formula, 30-day decision framework

## audit-rules-and-scoring

17 critical audit rules governing data interpretation and recommendations. Action scoring formula: Impact × Ease × Revenue Exposure (max 125). Tiering: Tier 1 (80+, do immediately), Tier 2 (40-79, schedule soon), Tier 3 (<40, backlog). Signal quality tags for low-data keywords. 30-day decision framework with check-in points.

**Common user intents:**
- What are the audit rules?
- How do I score actions?
- What tier is this action?
- How do I handle low-data keywords?

**Common confusions:**
- Ignoring signal quality tags on low-data keywords
- Treating all signals with equal confidence regardless of data volume

**Key objects:** 17 critical rules, Action scoring (max 125), Tier 1/2/3 classification, Signal quality tags, 30-day decision matrix, Revenue exposure weighting

## audit-database-execution

Supabase-backed audit execution: tables (audit_runs, phase_results, audit_findings, audit_actions, audit_baselines), functions (start_audit(), initialize_audit_phases()), and the mandatory Supabase Query Fallback Procedure (2-attempt maximum with diagnostic steps between attempts).

**Common user intents:**
- Start a new audit
- Resume a failed audit
- Check audit progress
- Query stored results
- What tables does the audit use?

**Common confusions:**
- Not saving phase results before ending a session
- Looping through repeated failed queries instead of following the fallback procedure
- Assuming table names without calling list_tables first

**Key objects:** audit_runs table, phase_results table, audit_findings table, audit_actions table, audit_baselines table, start_audit() function, initialize_audit_phases() function, audit_progress view, Supabase Query Fallback Procedure
