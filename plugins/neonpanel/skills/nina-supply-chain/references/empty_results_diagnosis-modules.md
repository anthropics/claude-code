# Empty Results Diagnosis — Module Map

## diagnostic-tree

The 5-check diagnostic decision tree for when supply_chain_list_po_placement_candidates or other planning tools return empty results. Checks: SKU existence → lead time → safety stock → forecast scenario → planning status.

**Common user intents:**
- Why did the tool return empty?
- No results came back
- PO placement returned nothing
- Debug empty results

**Common confusions:**
- Re-running the same tool hoping for different results
- Asking the user vague questions instead of running checks
- Not following the tree in order

**Artifacts to request:**
- Company ID
- SKU or ASIN that returned empty
- Which tool returned empty

**Key objects:** Check 1: SKU in snapshot, Check 2: lead_time_days, Check 3: safety_stock_days, Check 4: forecast scenario, Check 5: actively sold flag, Diagnostic output, Root cause

## root-cause-resolution

After identifying the root cause via the diagnostic tree, providing clear resolution steps — what the user needs to configure in NeonPanel and what the agent should re-run after.

**Common user intents:**
- How do I fix this?
- What do I need to configure?
- Can you fix it for me?

**Common confusions:**
- Thinking the agent can fix NeonPanel configuration directly
- Not providing specific NeonPanel navigation steps
- Not offering to re-run after the fix

**Key objects:** Resolution steps, NeonPanel configuration path, Re-run instructions, Escalation path
