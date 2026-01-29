---
name: launch-readiness
description: Create or update a launch readiness assessment
argument-hint: [product/feature name] or [update path/to/readiness.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "reassess", "refresh" in input | UPDATE | 100% |
| File path provided (`@path/to/readiness.md`) | UPDATE | 100% |
| "create", "new", "assess" in input | CREATE | 100% |
| "find", "search", "list assessments" | FIND | 100% |
| "the readiness", "launch readiness" | UPDATE | 85% |
| Just product/feature name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new readiness assessment using template below.

**UPDATE**:
1. Read existing assessment (search if path not provided)
2. Update Assessment Date to current
3. Update status indicators (🟢/🟡/🔴) for each area
4. Update blockers and recommendation
5. Show diff summary: "Reassessed on [date]. Changed: [areas]. Recommendation: [old] → [new]."

**FIND**:
1. Search paths below for readiness assessments
2. Present results: product, status, date, path
3. Ask: "Update one of these, or create new?"

### Search Locations for Launch Readiness

- `launch/`
- `releases/`
- `gtm/`
- `readiness/`

---

Assess **Launch Readiness** for a product or feature.

## V2V Phase

**Phase 4: Coordinated Execution** - Launch readiness assessment ensures all functions are ready.

**Prerequisites**: Launch plan completed, all Phase 3 commitments made
**Outputs used by**: Go/no-go decision, launch execution

## Output Structure

```markdown
# Launch Readiness: [Product/Feature Name]

**Assessment Date**: [Date]
**Assessed By**: [Name]
**Launch Date**: [Planned date]
**Overall Status**: 🟢 Go / 🟡 Conditional Go / 🔴 No Go

## Readiness Summary

| Area | Status | Blocker? |
|------|--------|----------|
| Product | 🟢/🟡/🔴 | Yes/No |
| Engineering | 🟢/🟡/🔴 | Yes/No |
| QA | 🟢/🟡/🔴 | Yes/No |
| Marketing | 🟢/🟡/🔴 | Yes/No |
| Sales | 🟢/🟡/🔴 | Yes/No |
| Support | 🟢/🟡/🔴 | Yes/No |
| Legal/Compliance | 🟢/🟡/🔴 | Yes/No |
| Operations | 🟢/🟡/🔴 | Yes/No |

## Product Readiness

| Criterion | Status | Notes |
|-----------|--------|-------|
| Core features complete | 🟢/🟡/🔴 | [Notes] |
| Known bugs acceptable | 🟢/🟡/🔴 | [Notes] |
| Performance acceptable | 🟢/🟡/🔴 | [Notes] |
| Security review complete | 🟢/🟡/🔴 | [Notes] |

## Engineering Readiness

| Criterion | Status | Notes |
|-----------|--------|-------|
| Code complete | 🟢/🟡/🔴 | [Notes] |
| Infrastructure ready | 🟢/🟡/🔴 | [Notes] |
| Monitoring in place | 🟢/🟡/🔴 | [Notes] |
| Rollback plan ready | 🟢/🟡/🔴 | [Notes] |

## QA Readiness

| Criterion | Status | Notes |
|-----------|--------|-------|
| Test plan executed | 🟢/🟡/🔴 | [Notes] |
| Critical bugs resolved | 🟢/🟡/🔴 | [Notes] |
| Regression complete | 🟢/🟡/🔴 | [Notes] |
| UAT complete | 🟢/🟡/🔴 | [Notes] |

## Marketing Readiness

| Criterion | Status | Notes |
|-----------|--------|-------|
| Messaging approved | 🟢/🟡/🔴 | [Notes] |
| Collateral ready | 🟢/🟡/🔴 | [Notes] |
| Website updated | 🟢/🟡/🔴 | [Notes] |
| Launch comms ready | 🟢/🟡/🔴 | [Notes] |

## Sales Readiness

| Criterion | Status | Notes |
|-----------|--------|-------|
| Sales trained | 🟢/🟡/🔴 | [Notes] |
| Demo ready | 🟢/🟡/🔴 | [Notes] |
| Pricing finalized | 🟢/🟡/🔴 | [Notes] |
| Contracts updated | 🟢/🟡/🔴 | [Notes] |

## Support Readiness

| Criterion | Status | Notes |
|-----------|--------|-------|
| Support trained | 🟢/🟡/🔴 | [Notes] |
| Documentation ready | 🟢/🟡/🔴 | [Notes] |
| KB articles published | 🟢/🟡/🔴 | [Notes] |
| Escalation path defined | 🟢/🟡/🔴 | [Notes] |

## Blockers

| Blocker | Owner | Resolution Plan | Due Date |
|---------|-------|-----------------|----------|
| [Blocker] | [Owner] | [Plan] | [Date] |

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| [Risk] | H/M/L | H/M/L | [Plan] |

## Recommendation

**Decision**: 🟢 Go / 🟡 Conditional Go / 🔴 No Go

**Rationale**: [Why this recommendation]

**Conditions** (if Conditional Go):
- [Condition 1]
- [Condition 2]
```

## Instructions

1. Review each area systematically
2. Reference any launch plans via @file syntax
3. Be rigorous about blockers
4. Make a clear recommendation
5. Save with launch documentation
