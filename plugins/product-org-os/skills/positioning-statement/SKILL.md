---
name: positioning-statement
description: Create or update a positioning statement
argument-hint: [product name] or [update path/to/positioning.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/positioning.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list positioning" | FIND | 100% |
| "the positioning", "our positioning" | UPDATE | 85% |
| Just product name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new positioning statement using template below.

**UPDATE**:
1. Read existing positioning doc (search if path not provided)
2. Preserve unchanged sections exactly
3. Update messaging, differentiation, or competitor sections
4. Increment version number
5. Show diff summary: "Updated: [sections]. Version: X → Y."

**FIND**:
1. Search paths below for positioning documents
2. Present results: product, version, date, path
3. Ask: "Update one of these, or create new?"

### Search Locations for Positioning

- `positioning/`
- `marketing/`
- `gtm/`
- `messaging/`

---

Create a **Positioning Statement** for the specified product.

## V2V Phase

**Phase 2: Strategic Decisions** - Positioning defines how we compete and is foundational to GTM.

**Prerequisites**: Phase 1 complete (competitive analysis, market segment, vision)
**Outputs used by**: Phase 3 (GTM strategy, messaging), Phase 4 (campaigns, sales enablement)

## Output Structure

```markdown
# Positioning Statement: [Product Name]

**Version**: [Version]
**Owner**: [Name]
**Date**: [Date]

## Positioning Statement

**For** [target customer segment]
**Who** [statement of need or opportunity]
**The** [product name]
**Is a** [product category]
**That** [key benefit / reason to buy]
**Unlike** [primary competitive alternative]
**Our product** [primary point of differentiation]

## Expanded Positioning

### Target Customer
**Who they are**: [Description]
**What they do**: [Role/function]
**What they care about**: [Priorities]

### Need / Opportunity
**The problem**: [What problem they face]
**Current solutions**: [How they solve it today]
**Gap**: [What's missing]

### Category
**Category we play in**: [Category name]
**Why this category**: [Rationale]
**Category alternatives**: [Other categories considered]

### Key Benefit
**Primary benefit**: [Main benefit]
**Benefit proof**: [Evidence]
**Benefit to whom**: [Which persona cares most]

### Differentiation
**Primary differentiator**: [What makes us different]
**Defensibility**: [Why hard to copy]
**Evidence**: [Proof of differentiation]

## Positioning vs. Competitors

| Competitor | Their Position | Our Position Against Them |
|------------|----------------|---------------------------|
| [Competitor 1] | [Their positioning] | [How we differ] |
| [Competitor 2] | [Their positioning] | [How we differ] |

## Positioning Perceptual Map

**Axes**:
- X-axis: [Dimension 1, e.g., Simple ← → Complex]
- Y-axis: [Dimension 2, e.g., Cheap ← → Premium]

**Our Position**: [Where we sit and why]

## Message Hierarchy

**Tagline**: [Short memorable phrase]
**Elevator Pitch** (30 seconds): [Brief pitch]
**Key Messages**:
1. [Message 1]
2. [Message 2]
3. [Message 3]

## Proof Points

| Claim | Proof |
|-------|-------|
| [Claim 1] | [Evidence] |
| [Claim 2] | [Evidence] |
| [Claim 3] | [Evidence] |

## Positioning by Audience

| Audience | Emphasis | Key Message |
|----------|----------|-------------|
| [Buyer] | [What to emphasize] | [Message] |
| [User] | [What to emphasize] | [Message] |
| [Influencer] | [What to emphasize] | [Message] |
```

## Instructions

1. Ask about target customer and competitors if not clear
2. Reference any competitive or market documents via @file syntax
3. Ensure differentiation is defensible
4. Include proof points for claims
5. Save in positioning/ or gtm/ folder
