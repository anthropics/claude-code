# Amazon Listing Audit Sop — Module Map

## audit-architecture

2-agent execution model: Technician (cheap model, data collection) and Strategist (expensive model, analysis) with human handoff via shared Supabase DB.

**Common user intents:**
- How does the 2-agent model work?
- Which model for which phase?

**Common confusions:**
- Running Strategist phases on a cheap model

**Key objects:** Technician agent, Strategist agent, Cost gate, Handoff protocol

## data-collection-phases

Phases 1-6 (Technician): product scrape, reviews, competitors, SERP, SQP, SCP, competitive landscape, PPC, cross-sell, repeat purchases.

**Common user intents:**
- Run a specific phase
- What tools does each phase use?

**Common confusions:**
- Analyzing data during collection phases

**Key objects:** Phase 1: Product Intelligence, Phase 2: SQP, Phase 3: SCP, Phase 4: Competitive, Phase 5: PPC, Phase 6: Cross-sell

## strategic-analysis-phases

Phases 7-10 (Strategist): content/image/video/Rufus audit, synthesis and diagnosis, prioritized action plan, baseline capture.

**Common user intents:**
- Run strategic analysis
- Generate action plan

**Common confusions:**
- Running analysis without complete data collection

**Key objects:** Phase 7: Content Audit, Phase 8: Synthesis, Phase 9: Action Plan, Phase 10: Baselines

## database-execution

Supabase-backed execution: audit_runs, phase_results, audit_findings, audit_actions, audit_baselines tables. Functions: start_audit(), initialize_audit_phases(). Includes structured fallback procedures for handling query failures — the agent must never loop through repeated failed attempts but instead follow a strict 2-attempt maximum with diagnostic steps between attempts and a clear exit if both fail.

**Common user intents:**
- Check audit progress
- Resume a failed audit
- Retrieve SOP or data from Supabase
- Query the database for stored results

**Common confusions:**
- Not saving phase results before ending session
- Looping through repeated failed queries instead of following the fallback procedure
- Not using list_tables to verify table existence before querying
- Assuming table names or schemas without checking first

**Artifacts to request:**
- Table name or data type being queried
- Supabase project ID if multiple projects exist

**Key objects:** phase_results table, audit_runs table, start_audit() function, audit_progress view, list_tables tool, execute_sql tool, query fallback procedure, 2-attempt maximum rule

## audit-rules-frameworks

17 critical rules, traffic diagnosis framework, action scoring (Impact × Ease × Revenue Exposure, max 125), 30-day decision framework.

**Common user intents:**
- What are the audit rules?
- How to score actions?

**Common confusions:**
- Ignoring signal quality tags on low-data keywords

**Key objects:** Critical rules (17), Diagnosis framework, Action scoring, 30-day decision matrix
