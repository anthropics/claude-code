# Accounting — Playbook

# Accounting Playbooks

1. **Sync failed** (`acct-sync-status`)
   - Symptom: Sync fails
   - Checks: integration, error message
   - Outcome: retry or escalate

2. **Bill missing** (`acct-bill-missing`)
   - Symptom: Bill missing
   - Checks: bill ID, vendor
   - Outcome: confirm status in source system

3. **Mapping mismatch** (`acct-mapping-errors`)
   - Symptom: Mapping mismatch
   - Checks: account names, mapping export
   - Outcome: request mapping export

4. **Totals mismatch** (`acct-reconciliation`)
   - Symptom: Totals mismatch
   - Checks: report period
   - Outcome: request report export

5. **Auth expired** (`acct-auth`)
   - Symptom: Authorization error
   - Checks: error message
   - Outcome: re-auth or escalate

6. **Duplicate entries** (`acct-sync-status`)
   - Symptom: Duplicates
   - Checks: sync job ID
   - Outcome: collect evidence

7. **Vendor mapping** (`acct-bill-missing`)
   - Symptom: Vendor mismatch
   - Checks: vendor name
   - Outcome: request mapping export

8. **Chart mismatch** (`acct-mapping-errors`)
   - Symptom: Chart of accounts differs
   - Checks: chart export
   - Outcome: request export

9. **Reconciliation audit** (`acct-reconciliation`)
   - Symptom: Audit request
   - Checks: period, report type
   - Outcome: collect exports and escalate

10. **Repeated auth failures** (`acct-auth`)
    - Symptom: Auth fails repeatedly
    - Checks: timestamp
    - Outcome: escalate

11. **Landed cost services missing** (`acct-mapping-errors`)
   - Symptom: Only Amazon/non-landed services appear in Bill Item List
   - Checks: whether a shipment or inventory order was attached in Bill Info
   - Outcome: attach shipment/order in Bill Info, then re-open Item List

## Metric Contributor / Breakdown Drilldown

When a user asks about contributors, breakdowns, or what's driving a metric (e.g. "what are the biggest contributors to lost COGS?"):

1. **Identify the metric and date range.** Confirm which metric the user is asking about (COGS, revenue, landed cost, etc.) and the time period.
2. **Query at the most granular level immediately.** Always drill down to SKU-level or transaction-level data in the first response. Do NOT summarize into high-level buckets.
3. **Present all items ranked by impact.** Show results sorted by contribution (highest to lowest). If there are many items, show the top 10–15 with their individual values and percentages.
4. **Never create catch-all categories.** Do not lump remaining items into "Other", "Untracked", or similar buckets. If the list is long, offer to show the next batch — but always with individual line items.
5. **If granular data is unavailable, say so explicitly.** State "I don't have SKU-level data for this metric" rather than speculating or filling in with aggregated placeholders.
6. **Offer deeper analysis.** After presenting the breakdown, proactively offer to drill further (e.g. "Want me to look at the transaction history for any of these SKUs?").