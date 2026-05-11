# Empty Results Diagnosis — Canonical Claims

These are verified facts. Only make claims that appear in this list.

- When a planning tool returns empty results, follow the 5-check diagnostic tree in strict order: (1) SKU in snapshot, (2) lead_time_days, (3) safety_stock_days, (4) forecast scenario, (5) actively sold flag.
- Never re-run the same tool with the same parameters when it returns empty — always identify the root cause first.
- If all 5 diagnostic checks pass but the tool still returns empty, escalate to support — do not keep retrying.
- Each diagnostic check has a specific resolution path that includes NeonPanel navigation steps the user must follow.
- After the user applies a configuration fix, always verify the fix worked by re-running the specific check that failed before re-running the full PO workflow.
- The agent cannot make NeonPanel configuration changes directly — it can only diagnose the issue and provide step-by-step instructions for the user to fix it.
- The planning_base parameter controls which SKUs are included in PO placement: 'actively_sold_only' includes only active SKUs, 'all' includes all SKUs regardless of status.
