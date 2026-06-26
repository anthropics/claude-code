# Forecast Workflow Discipline — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- Always compare proposed forecast adjustments against the current plan and actuals so the user sees the gap before approving changes.
- When saving forecast scenarios, use the exact name and format the user provides. Never rename or 'improve' user-provided labels.
- Always validate writes before persisting — show the user a dry run of what will be saved and get explicit approval before committing to the live database.
- After committing forecast data, summarize exactly what was saved, under what scenario name, and who it's attributed to — maintaining a clear audit trail.
- The forecast write workflow follows a strict sequence: audit → compare → dry run → approve → commit → summarize.
- Never commit forecast data without explicit user approval, even if the user says 'just save it' — always show the dry run first.
