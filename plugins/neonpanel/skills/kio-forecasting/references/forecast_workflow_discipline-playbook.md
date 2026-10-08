# Forecast Workflow Discipline — Playbook

# Forecast Workflow Discipline Playbooks

## Forecast Write Workflow

1. **Audit the current state.** Pull the current plan data for the relevant SKUs and date range. Compare against actual sales velocity to identify the gap.
2. **Show the gap.** Present a table comparing current plan vs. actuals so the user sees exactly where the forecast diverges from reality before making changes.
3. **Capture the scenario name.** Ask the user what to name this scenario. Use their exact name and format — never rename or "improve" it.
4. **Dry run the write.** Show the user exactly what will be saved: which SKUs, which months, what values, under what scenario name. This is a preview, not a commit.
5. **Get explicit approval.** Wait for the user to confirm the dry run looks correct. Do not proceed without a clear "yes" or equivalent approval.
6. **Commit to the live database.** Write the approved data to the database under the user's scenario name.
7. **Summarize the audit trail.** Confirm exactly what was saved: scenario name, SKUs and date range affected, values written, who it's attributed to, and timestamp.

## Audit Trail Review

1. **Identify the scope.** Ask which scenario, time period, or SKU set the user wants to review.
2. **Retrieve committed data.** Pull the saved scenario data including scenario name, save date, and attribution.
3. **Present the record.** Show a clean table of what was committed — values, SKUs, date range, scenario name, and who approved it.
4. **Compare if requested.** If the user wants to compare against actuals or a previous version, pull that data and show a side-by-side comparison.
5. **Flag discrepancies.** If committed data doesn't align with current actuals or expectations, highlight the gaps and ask if the user wants to investigate further.