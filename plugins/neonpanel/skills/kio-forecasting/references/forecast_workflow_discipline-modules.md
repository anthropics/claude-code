# Forecast Workflow Discipline — Module Map

## forecast-write-workflow

The step-by-step discipline for writing forecast data: audit current plan against actuals, show the gap, dry run the proposed write, get explicit user approval, commit to the live database, and summarize the audit trail.

**Common user intents:**
- Save this forecast
- Write these numbers to the plan
- Commit this scenario
- Update the forecast

**Common confusions:**
- Thinking the agent can commit without explicit approval
- Expecting the agent to auto-save without a dry run
- Not understanding the audit trail requirement

**Artifacts to request:**
- Current plan data for comparison
- Proposed adjustments to validate

**Key objects:** Current plan, Actuals comparison, Proposed adjustments, Dry run preview, User approval gate, Commit confirmation, Audit trail summary

## scenario-naming-conventions

Rules for handling user-provided scenario names, labels, and formatting conventions. The agent must use the user's exact naming — never rename, relabel, or 'improve' user-provided identifiers. After commits, attribution must include the scenario name, what was saved, and who it's attributed to.

**Common user intents:**
- Save this as scenario X
- Name this forecast Y
- What was the last scenario I saved?
- Show me the audit trail

**Common confusions:**
- Agent renaming scenarios for 'clarity'
- Not preserving the user's exact formatting
- Missing attribution details after commit

**Artifacts to request:**
- User's preferred naming convention
- Scenario name for the current write

**Key objects:** Scenario name, User-provided label, Attribution record, Naming format
