---
name: competitive-analysis
description: Create or update a competitive analysis
argument-hint: [competitor name or market] or [update path/to/analysis.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "refresh", "revise" in input | UPDATE | 100% |
| File path provided (`@path/to/analysis.md`) | UPDATE | 100% |
| "create", "new", "analyze" in input | CREATE | 100% |
| "find", "search", "list analyses" | FIND | 100% |
| "the [Competitor] analysis" | UPDATE | 85% |
| Just competitor name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new competitive analysis using template below.

**UPDATE**:
1. Read existing analysis (search if path not provided)
2. Update Analysis Date and Confidence Level
3. Refresh strengths, weaknesses, and market position
4. Update win/loss patterns with new data
5. Show diff summary: "Updated: [sections]. Analysis date: [old] → [new]."

**FIND**:
1. Search paths below for competitor analyses
2. Present results: competitor name, date, confidence, path
3. Ask: "Update one of these, or create new?"

### Search Locations for Competitive Analysis

- `competitive/`
- `competitors/`
- `market/competitors/`
- `research/`

---

Structure a **Competitive Analysis** for a specific competitor or market.

## V2V Phase

**Phase 1: Strategic Foundation** - Focused competitive analysis informs positioning and differentiation.

**Prerequisites**: Competitor identified, market context understood
**Outputs used by**: Phase 2 (positioning), Phase 4 (battle cards, sales enablement)

## Output Structure

```markdown
# Competitive Analysis: [Competitor Name]

**Analysis Date**: [Date]
**Analyst**: [Name]
**Confidence Level**: High / Medium / Low

## Competitor Overview

**Company**: [Name]
**Founded**: [Year]
**HQ**: [Location]
**Size**: [Employees, if known]
**Funding**: [Funding status]
**Revenue**: [If known]

## Product Overview

**Product Name**: [Name]
**Category**: [Category]
**Target Market**: [Who they sell to]
**Pricing Model**: [How they price]
**Price Range**: [Approximate prices]

## Positioning

**Their Tagline**: [Their tagline/positioning]
**Primary Message**: [What they lead with]
**Differentiation Claim**: [What they claim is different]

## Strengths

| Strength | Evidence | Threat Level |
|----------|----------|--------------|
| [Strength 1] | [Evidence] | High/Med/Low |
| [Strength 2] | [Evidence] | High/Med/Low |
| [Strength 3] | [Evidence] | High/Med/Low |

## Weaknesses

| Weakness | Evidence | Opportunity |
|----------|----------|-------------|
| [Weakness 1] | [Evidence] | [How to exploit] |
| [Weakness 2] | [Evidence] | [How to exploit] |
| [Weakness 3] | [Evidence] | [How to exploit] |

## Feature Comparison

| Feature | Them | Us | Advantage |
|---------|------|-----|-----------|
| [Feature 1] | ✓/✗/◐ | ✓/✗/◐ | Them/Us/Tie |
| [Feature 2] | ✓/✗/◐ | ✓/✗/◐ | Them/Us/Tie |
| [Feature 3] | ✓/✗/◐ | ✓/✗/◐ | Them/Us/Tie |

## Pricing Comparison

| Tier | Their Price | Our Price | Analysis |
|------|-------------|-----------|----------|
| Entry | $X | $X | [Analysis] |
| Mid | $X | $X | [Analysis] |
| High | $X | $X | [Analysis] |

## Win/Loss Analysis

**When We Win Against Them**:
- [Pattern 1]
- [Pattern 2]

**When We Lose To Them**:
- [Pattern 1]
- [Pattern 2]

## Market Position

**Market Share**: [Estimate if known]
**Trend**: Growing / Stable / Declining
**Recent Moves**: [Recent product/business moves]

## Strategic Intent

**Where They're Heading**: [Strategic direction]
**Threats to Watch**: [What might hurt us]
**Opportunities**: [Where we can gain]

## Recommended Response

**Short-term** (This quarter):
- [Action 1]

**Medium-term** (Next 2-3 quarters):
- [Action 1]

**Long-term** (This year+):
- [Action 1]
```

## Instructions

1. Use WebSearch for current competitive information
2. Reference any existing competitive documents via @file syntax
3. Be objective - acknowledge competitor strengths
4. Include actionable recommendations
5. Save in competitive/ folder
6. Offer to create presentation version using /present
