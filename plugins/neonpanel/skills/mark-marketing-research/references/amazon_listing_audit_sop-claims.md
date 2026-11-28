# Amazon Listing Audit Sop — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- When a Supabase query returns empty results or fails, the agent must follow the Supabase Query Fallback Procedure — never retry the same failing query more than twice total.
- The agent must NEVER loop through 3 or more failed Supabase query attempts. The hard maximum is 2 attempts with a diagnostic step between them.
- Before querying any Supabase table, the agent must first call list_tables to confirm the table exists and verify the exact table name.
- If a Supabase query returns an empty array, the agent must run a diagnostic query (SELECT count(*) or SELECT * LIMIT 5) before retrying with a modified approach.
- If both Supabase query attempts fail, the agent must clearly state the specific technical limitation (e.g., 'The table exists but appears empty' or 'The table was not found in the database') and offer concrete alternatives.
- Acceptable alternatives after Supabase query failure: (1) offer to check a different table that might contain the data, (2) suggest the user check Supabase dashboard directly, (3) offer to work with the data if the user pastes it.
- The agent must never say vague phrases like 'let me try again' without explaining what it will do differently on the next attempt.
- When querying Supabase, always use explicit column selection (SELECT specific_columns) rather than SELECT * on large tables to avoid timeout issues.
- If list_tables shows the target table does not exist, do not attempt to query it — immediately inform the user the table is not in the database.
- The audit uses a 2-agent execution model: Technician (cheap model) handles data collection phases 1-6, Strategist (expensive model) handles analysis phases 7-10.
- Never run Strategist-level analysis on a Technician (cheap) model — the output quality will be insufficient for strategic recommendations.
- The Technician must complete and save ALL data collection phases (1-6) to Supabase before handing off to the Strategist.
- Audit data is stored in Supabase tables: audit_runs, phase_results, audit_findings, audit_actions, and audit_baselines.
- The start_audit() function creates a new audit run, and initialize_audit_phases() sets up the phase tracking structure.
- Action scoring uses the formula: Impact × Ease × Revenue Exposure, with a maximum score of 125.
- Actions are tiered by score: Tier 1 (score 80+, do immediately), Tier 2 (40-79, schedule soon), Tier 3 (below 40, backlog).
- The 30-day decision framework defines check-in points for measuring the impact of implemented audit actions.
- There are 17 critical audit rules that govern how data is interpreted and recommendations are made.
- Signal quality tags must be applied to low-data keywords — do not treat low-confidence signals the same as high-confidence ones.
- Parallel execution is supported: multiple Technician chats can run different data collection phases simultaneously, but all must save to the same audit_run_id.
- Phase results must be saved to Supabase before ending any session — unsaved data is lost.
