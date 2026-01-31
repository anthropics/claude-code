---
name: gtm-brief
description: Create or update a go-to-market brief
argument-hint: [product/feature name] or [update path/to/gtm-brief.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/gtm-brief.md`) | UPDATE | 100% |
| Brief ID mentioned (`GTM-2026-001`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list briefs" | FIND | 100% |
| "the GTM brief", "the brief" | UPDATE | 85% |
| Just product/feature name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new GTM brief using template below.

**UPDATE**:
1. Read existing brief (search if path not provided)
2. Preserve positioning and core messaging
3. Update activities, dates, or success metrics
4. Update status (Draft → In Review → Approved)
5. Show diff summary: "Updated: [sections]. Status: [old] → [new]."

**FIND**:
1. Search paths below for GTM briefs
2. Present results: product, launch date, status, path
3. Ask: "Update one of these, or create new?"

### Search Locations for GTM Briefs

- `gtm/`
- `launch/`
- `marketing/`
- `briefs/`

---

Create a **Go-to-Market Brief** for a product or feature launch.

## V2V Phase

**Phase 3: Strategic Commitments** - GTM briefs summarize the go-to-market commitment for execution.

**Prerequisites**: GTM strategy approved, positioning finalized
**Outputs used by**: Phase 4 (campaigns, sales enablement, launch activities)

## Output Structure

```markdown
# GTM Brief: [Product/Feature Name]

**Brief ID**: GTM-[YYYY]-[NNN]
**Owner**: [Name]
**Launch Date**: [Date]
**Status**: Draft / In Review / Approved

## Launch Overview

**What**: [What's being launched - 1 sentence]
**Why**: [Why it matters - 1 sentence]
**When**: [Launch date and any phases]

## Target Market

**Primary Segment**: [Description]
**Secondary Segment**: [Description]
**Market Size**: [TAM/SAM/SOM if known]

## Target Buyer

**Title/Role**: [Who buys]
**Pain Points**:
- [Pain 1]
- [Pain 2]
- [Pain 3]

**Buying Triggers**:
- [Trigger 1]
- [Trigger 2]

## Positioning

**Category**: [What category we compete in]

**Positioning Statement**:
For [target customer] who [need], [product] is a [category] that [benefit]. Unlike [competitor], we [differentiator].

## Key Messages

**Primary Message**: [Main message - one sentence]

**Supporting Messages**:
1. [Message 1]
2. [Message 2]
3. [Message 3]

**Proof Points**:
- [Proof point 1]
- [Proof point 2]

## Competitive Positioning

| Competitor | Their Strength | Our Response |
|------------|----------------|--------------|
| [Competitor 1] | [Strength] | [Response] |
| [Competitor 2] | [Strength] | [Response] |

## Pricing

**Model**: [Pricing model]
**Price Points**: [Prices]
**Packaging**: [Tiers/options]

## Launch Activities

| Activity | Owner | Date | Status |
|----------|-------|------|--------|
| [Activity 1] | [Owner] | [Date] | [Status] |
| [Activity 2] | [Owner] | [Date] | [Status] |

## Success Metrics

| Metric | Target | Timeframe |
|--------|--------|-----------|
| [Metric 1] | [Target] | [When] |
| [Metric 2] | [Target] | [When] |

## Sales Enablement Needs

- [ ] Sales deck
- [ ] Demo script
- [ ] Battle cards
- [ ] FAQ
- [ ] Pricing guide
```

## Instructions

1. Ask about launch date if not specified
2. Reference any positioning or competitive documents via @file syntax
3. Keep brief focused and actionable
4. Include clear success metrics
5. Save in gtm/ folder
6. Offer to create presentation version using /present
