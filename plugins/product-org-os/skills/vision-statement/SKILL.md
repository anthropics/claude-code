---
name: vision-statement
description: Create or update a product vision statement
argument-hint: [product name] or [update path/to/vision.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "refine" in input | UPDATE | 100% |
| File path provided (`@path/to/vision.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list visions" | FIND | 100% |
| "the vision", "our vision" | UPDATE | 85% |
| Just product name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new vision statement using template below.

**UPDATE**:
1. Read existing vision (search if path not provided)
2. Preserve structure and aspirational elements
3. Refine specific sections based on new context
4. Show diff summary: "Updated: [sections]. Core vision preserved."

**FIND**:
1. Search paths below for vision documents
2. Present results: product, date, path
3. Ask: "Update one of these, or create new?"

### Search Locations for Vision Statements

- `strategy/`
- `vision/`
- `docs/`
- Root level (`*vision*.md`)

---

Draft a **Product Vision Statement** for the specified product.

## V2V Phase

**Phase 1: Strategic Foundation** - Vision statements establish the aspirational direction that guides all downstream decisions.

**Prerequisites**: Market opportunity identified, executive mandate
**Outputs used by**: Phase 2 (positioning, business case), Phase 3 (roadmap, GTM)

## Output Structure

```markdown
# Product Vision: [Product Name]

## Vision Statement

**For** [target customer]
**Who** [statement of need or opportunity]
**The** [product name]
**Is a** [product category]
**That** [key benefit, reason to buy]
**Unlike** [primary competitive alternative]
**Our product** [primary differentiation]

## One-Line Vision
[Aspirational statement about the future this product creates - one sentence]

## Vision Narrative
[2-3 paragraph narrative describing the world we're creating]

## Who We Serve

### Primary Customer
- **Who**: [Description]
- **Their Goal**: [What they're trying to achieve]
- **Their Pain**: [What prevents them today]

### Secondary Customer
- **Who**: [Description]
- **Their Goal**: [What they're trying to achieve]
- **Their Pain**: [What prevents them today]

## Core Problem We Solve
[Clear articulation of the problem]

## Our Unique Approach
[What makes our solution different]

## Success Looks Like
- For customers: [What success means for them]
- For us: [What success means for our business]
- For the market: [How we change the market]

## Vision Timeline

| Horizon | Timeframe | What We Achieve |
|---------|-----------|-----------------|
| Near-term | 0-12 months | [Milestones] |
| Mid-term | 1-3 years | [Milestones] |
| Long-term | 3-5 years | [Milestones] |

## Guiding Principles
1. [Principle 1]
2. [Principle 2]
3. [Principle 3]
```

## Instructions

1. Ask about target customers if not specified
2. Reference any strategy documents provided via @file syntax
3. Keep vision aspirational but achievable
4. Ensure differentiation is clear
5. Save in strategy/ folder
6. Offer to create presentation version using /present
