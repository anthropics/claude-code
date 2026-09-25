# Audit Completeness

Cross-reference **$ARGUMENTS** against its source of truth. This is a focused accuracy and completeness audit — not a structural or stylistic review.

---

## Methodology

### Step 1: Identify the Source of Truth

Determine what the documentation/artifact *claims to describe*, then locate the authoritative source:

| Artifact Type | Source of Truth |
|--------------|-----------------|
| Tool/API documentation | Actual code, schema definitions (Zod, JSON Schema, OpenAPI) |
| Configuration reference | Config file parsers, CLI argument handlers, env var readers |
| Architecture docs | Actual module structure, dependency graph, deployed topology |
| Test documentation | Actual test files, coverage reports, CI configuration |
| Changelog/release notes | Git history, package versions, deployed artifacts |

### Step 2: Extract from Source

Using Explore subagents or Bash, extract the **actual** values from the source of truth:
- Parameter names, types, required/optional status
- Default values (from code, not from docs)
- Constraints (min, max, enum values, regex patterns)
- Feature flags and availability conditions
- Aliases and historical names

### Step 3: Diff Against Documentation

For every item in the documentation, check:

| Check | Finding Type |
|-------|-------------|
| Item exists in source but not in doc | **Missing** |
| Item exists in doc but not in source | **Stale/Removed** |
| Item exists in both but values differ | **Incorrect** |
| Item exists in both, doc is vague, source is precise | **Imprecise** |
| Item exists in both, source has constraints doc doesn't mention | **Under-documented** |

### Step 4: Report

Produce a structured delta report:

```markdown
## Completeness Audit: [artifact name]

### Summary
- Items in source of truth: N
- Items documented: M
- Missing: X
- Stale: Y
- Incorrect: Z
- Imprecise: W

### Critical (Incorrect)
| Item | Documented Value | Actual Value | Location |
|------|-----------------|--------------|----------|

### Major (Missing)
| Item | Source Location | What Should Be Documented |
|------|----------------|--------------------------|

### Minor (Imprecise / Under-documented)
| Item | Current Doc | More Precise Value | Source |
|------|-------------|-------------------|--------|

### Stale (Removed from Source)
| Item | Doc Location | Notes |
|------|-------------|-------|
```

### Step 5: Apply

Fix all Critical and Major findings. Fix Minor findings if low-effort. Remove Stale entries. Commit with the delta report as the commit message body.

---

## Common Documentation Lies to Check

These are the most frequent divergences between docs and reality:

- [ ] Default values that changed in code but not in docs
- [ ] Enum values that were added (new options) but not documented
- [ ] Enum values that were removed but still documented
- [ ] Constraints that were loosened (higher max) or tightened (lower max)
- [ ] Parameters that were added but not documented
- [ ] Parameters that were renamed (old name still in docs)
- [ ] Parameters that were removed but still documented
- [ ] Features gated behind flags/conditions that docs don't mention
- [ ] Aliases that exist in code but aren't documented
- [ ] Internal parameters exposed in schema but intentionally undocumented
