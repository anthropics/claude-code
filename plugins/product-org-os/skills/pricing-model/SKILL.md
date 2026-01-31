---
name: pricing-model
description: Create or update a pricing model
argument-hint: [product name] or [update path/to/pricing-model.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "change" in input | UPDATE | 100% |
| File path provided (`@path/to/pricing-model.md`) | UPDATE | 100% |
| "create", "new", "design" in input | CREATE | 100% |
| "find", "search", "list models" | FIND | 100% |
| "the pricing model", "our pricing" | UPDATE | 85% |
| Just product name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new pricing model using template below.

**UPDATE**:
1. Read existing model (search if path not provided)
2. Preserve pricing philosophy and rationale
3. Update price points, tiers, or feature matrix
4. Increment version number
5. Show diff summary: "Updated: [sections]. Version: X → Y."

**FIND**:
1. Search paths below for pricing models
2. Present results: product, version, status, path
3. Ask: "Update one of these, or create new?"

### Search Locations for Pricing Models

- `pricing/`
- `strategy/pricing/`
- `gtm/`
- `business/`

---

Design a **Pricing Model** for the specified product.

## V2V Phase

**Phase 2: Strategic Decisions** - Pricing model selection is a key commercial decision.

**Prerequisites**: Value proposition defined, competitive context understood
**Outputs used by**: Pricing strategy, GTM strategy, sales enablement

## Output Structure

```markdown
# Pricing Model: [Product Name]

**Version**: [Version number]
**Owner**: [Name]
**Effective Date**: [Date]
**Status**: Draft / Proposed / Approved / Active

## Pricing Philosophy

**Value Basis**: [What customers are paying for]
**Pricing Approach**: Value-based / Cost-plus / Competitive / Penetration

## Pricing Model Type

**Selected Model**: [Per user / Per usage / Flat rate / Tiered / Freemium / etc.]

**Rationale**: [Why this model fits]

**Alternatives Considered**:
| Model | Pros | Cons | Why Not |
|-------|------|------|---------|
| [Alt 1] | [Pros] | [Cons] | [Reason] |
| [Alt 2] | [Pros] | [Cons] | [Reason] |

## Pricing Tiers

| Tier | Price | Billing | Target Segment | Key Limits |
|------|-------|---------|----------------|------------|
| Free | $0 | - | [Segment] | [Limits] |
| Starter | $X/mo | Monthly/Annual | [Segment] | [Limits] |
| Professional | $X/mo | Monthly/Annual | [Segment] | [Limits] |
| Enterprise | Custom | Annual | [Segment] | Unlimited |

## Feature Matrix

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| [Feature 1] | ✓ | ✓ | ✓ | ✓ |
| [Feature 2] | ✗ | ✓ | ✓ | ✓ |
| [Feature 3] | ✗ | ✗ | ✓ | ✓ |
| [Feature 4] | ✗ | ✗ | ✗ | ✓ |

## Usage Limits

| Metric | Free | Starter | Pro | Enterprise |
|--------|------|---------|-----|------------|
| [Users] | X | X | X | Unlimited |
| [Storage] | X GB | X GB | X GB | Unlimited |
| [API calls] | X/mo | X/mo | X/mo | Unlimited |

## Add-Ons

| Add-On | Price | Available On |
|--------|-------|--------------|
| [Add-on 1] | $X/mo | Pro+ |
| [Add-on 2] | $X/mo | All paid |

## Discount Policy

| Discount Type | Amount | Approval | Criteria |
|---------------|--------|----------|----------|
| Annual prepay | X% | Auto | Commit to annual |
| Multi-year | X% | Manager | 2+ year commit |
| Volume | Up to X% | Director | X+ seats |
| Strategic | Up to X% | VP | Strategic account |

## Competitive Comparison

| Competitor | Their Price | Our Price | Position |
|------------|-------------|-----------|----------|
| [Comp 1] | $X | $X | Premium/Parity/Value |

## Financial Model

| Scenario | ARPU | Customers | MRR |
|----------|------|-----------|-----|
| Conservative | $X | X | $X |
| Base | $X | X | $X |
| Optimistic | $X | X | $X |
```

## Instructions

1. Ask about target segments and value metrics if not clear
2. Reference any competitive or financial documents via @file syntax
3. Ensure tiers have clear upgrade paths
4. Include competitive context
5. Save in pricing/ folder
6. Offer to create presentation version using /present
