# Demo Data Handling (MANDATORY)

This rule governs how demo data is handled when coexisting with production data.

---

## The Principle

> Demo data exists to teach the system, not to pollute production context. Once users start their own work, demo data should fade into the background.

---

## Auto-Filtering Behavior

### Detection: Is There Production Data?

Check for production data by scanning:
- `context/decisions/` - Any file NOT in `context/demo/`
- `context/bets/` - Any file NOT in `context/demo/`
- `context/feedback/` - Any file NOT in `context/demo/`
- `context/documents/` - Any entry NOT containing "DEMO" in ID

**Production data exists if**: Any of the above folders contain user-created content.

### Default Behavior

| Production Data Exists? | Demo Data Behavior |
|------------------------|-------------------|
| **No** | Include demo data, mark as `[DEMO]` |
| **Yes** | **Exclude demo data by default** |

### Override Flags

| Flag | Effect |
|------|--------|
| `--include-demo` | Always include demo data (marked as `[DEMO]`) |
| `--demo-only` | Show only demo data (for learning/testing) |

---

## Identification Rules

### How to Identify Demo Data

Demo content is identified by **ANY** of:
1. **Path**: Located in `context/demo/` folder
2. **ID**: Contains "DEMO" in the ID (e.g., `DR-DEMO-001`, `SB-DEMO-002`)
3. **Marker**: Contains `[DEMO DATA]` text in file

### JSON Index

In `context/index.json`, demo entries include:
```json
{
  "id": "DR-DEMO-001",
  "demo": true,
  "path": "context/demo/decisions/DR-DEMO-001-pricing-model.md"
}
```

The `demo: true` field enables fast filtering.

---

## Display Format

### When Demo Data Is Shown

Always prefix demo results with clear markers:

```markdown
### Decisions

| ID | Title | Status |
|----|-------|--------|
| DR-2026-001 | Pricing Strategy | Accepted |
| `[DEMO]` DR-DEMO-001 | Demo Pricing Model | Demo |

---
*Note: Results include demo data. Use `--exclude-demo` to hide.*
```

### When Demo Data Is Excluded

If user queries with production data present and no `--include-demo`:

```markdown
### Decisions

| ID | Title | Status |
|----|-------|--------|
| DR-2026-001 | Pricing Strategy | Accepted |

---
*3 demo results excluded. Use `--include-demo` to show.*
```

---

## Skills That Must Apply This Rule

All context-querying skills:
- `/context-recall`
- `/feedback-recall`
- `/portfolio-status`
- `/relevant-learnings`

### Behavior Summary

```
/context-recall pricing
→ If production data exists: Exclude demo, show count of excluded
→ If no production data: Include demo with [DEMO] markers

/context-recall pricing --include-demo
→ Always include demo with [DEMO] markers

/context-recall pricing --demo-only
→ Only show demo data (for testing/learning)
```

---

## Implementation Checklist

When implementing context queries:

- [ ] Check if production data exists in main context folders
- [ ] If yes, exclude demo data by default
- [ ] If no, include demo data with clear `[DEMO]` markers
- [ ] Support `--include-demo` flag to override exclusion
- [ ] Support `--demo-only` flag for testing
- [ ] Show count of excluded demo results
- [ ] Never mix demo and production data without clear labeling

---

## Why This Matters

1. **Prevents confusion**: Users don't accidentally reference demo decisions in real work
2. **Clean slate**: Production context isn't cluttered with sample data
3. **Reversible**: Users can always see demo data if they want it
4. **Safe coexistence**: Demo data remains available for reference without polluting queries

---

## V2V Operating Principle

> "Demo data is training wheels. Once you're riding, they should automatically retract—but remain available if you need to practice again."
