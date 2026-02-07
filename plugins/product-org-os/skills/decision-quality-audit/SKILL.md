---
name: decision-quality-audit
description: Create or update an audit of recent decisions for quality
argument-hint: [team, time period, or decision type] or [update path/to/audit.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "add decisions", "refresh" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| "create", "new", "run" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the audit", "last audit" | UPDATE | 85% |
| Just team/period/type | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new audit using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve historical scores and trend data
3. Update with new decisions or findings
4. Show diff summary with score changes

**FIND**: Check registry, then search user's folders for audit reports.

---

Audit **Decision Quality** for a set of recent decisions.

## V2V Context
**Phase 6: Learning & Adaptation Loop** - Decision quality is the core metric for product leadership effectiveness.

## Output Structure

```markdown
# Decision Quality Audit: [Scope]

**Audit Date**: [Date]
**Auditor**: [Name]
**Period**: [Timeframe audited]
**Decisions Reviewed**: [Number]

## Executive Summary

**Overall Decision Quality Score**: [X/5]
**Key Finding**: [One sentence summary]
**Priority Improvement**: [One area to focus on]

## Decisions Audited

| Decision | Date | Owner | Type | Quality Score |
|----------|------|-------|------|---------------|
| [Decision 1] | [Date] | [Owner] | Strategic/Portfolio/Execution | X/5 |
| [Decision 2] | [Date] | [Owner] | Strategic/Portfolio/Execution | X/5 |

## Quality Criteria Assessment

### 1. Clear Ownership
**Score**: [X/5]
**Finding**: [What we found]
**Evidence**:
- X% of decisions had single accountable owner
- [Other evidence]

### 2. Explicit Options Considered
**Score**: [X/5]
**Finding**: [What we found]
**Evidence**:
- X% documented alternatives
- [Other evidence]

### 3. Success Criteria Defined
**Score**: [X/5]
**Finding**: [What we found]
**Evidence**:
- X% had measurable success criteria
- [Other evidence]

### 4. Re-decision Triggers Defined
**Score**: [X/5]
**Finding**: [What we found]
**Evidence**:
- X% defined when to revisit
- [Other evidence]

### 5. Assumptions Documented
**Score**: [X/5]
**Finding**: [What we found]
**Evidence**:
- X% had explicit assumptions
- [Other evidence]

### 6. Appropriate Input Gathered
**Score**: [X/5]
**Finding**: [What we found]
**Evidence**:
- X% involved right stakeholders
- [Other evidence]

### 7. Timely Decision-Making
**Score**: [X/5]
**Finding**: [What we found]
**Evidence**:
- Average decision time: X days
- [Other evidence]

## Quality Scorecard

| Criterion | Score | Trend | Priority |
|-----------|-------|-------|----------|
| Clear Ownership | X/5 | ↑/↓/→ | High/Med/Low |
| Options Considered | X/5 | ↑/↓/→ | High/Med/Low |
| Success Criteria | X/5 | ↑/↓/→ | High/Med/Low |
| Re-decision Triggers | X/5 | ↑/↓/→ | High/Med/Low |
| Assumptions Documented | X/5 | ↑/↓/→ | High/Med/Low |
| Appropriate Input | X/5 | ↑/↓/→ | High/Med/Low |
| Timely Decision | X/5 | ↑/↓/→ | High/Med/Low |

## Pattern Analysis

### What's Working
| Pattern | Evidence | Impact |
|---------|----------|--------|
| [Pattern] | [Evidence] | [Impact] |

### What Needs Improvement
| Pattern | Evidence | Impact | Recommendation |
|---------|----------|--------|----------------|
| [Pattern] | [Evidence] | [Impact] | [Recommendation] |

## Recommendations

### Process Improvements
1. [Recommendation]

### Template/Tool Improvements
1. [Recommendation]

### Training/Coaching Needs
1. [Recommendation]

## Follow-up Actions

| Action | Owner | Due Date |
|--------|-------|----------|
| [Action] | [Owner] | [Date] |

## Next Audit

**Scheduled**: [Date]
**Focus Areas**: [What to emphasize]
```

## Instructions

1. Gather recent decision records to audit
2. Reference decision records and charters via @file syntax
3. Score objectively against criteria
4. Identify patterns, not just individual issues
5. Save in audits/ folder
6. Offer to create presentation version using /present
