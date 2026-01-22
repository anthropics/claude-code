---
name: pricing-strategy
description: Create or update a pricing strategy document
argument-hint: [product or feature name] or [update path/to/pricing.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/pricing.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list pricing" | FIND | 100% |
| "the pricing", "our pricing strategy" | UPDATE | 85% |
| Just product/feature name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new pricing strategy using template below.

**UPDATE**:
1. Read existing pricing doc (search if path not provided)
2. Preserve unchanged sections exactly
3. Update specific elements (price points, tiers, discounts)
4. Show diff summary: "Updated: [sections]. Unchanged: [sections]."
5. Note: Financial projections may need recalculation

**FIND**:
1. Search paths below for pricing documents
2. Present results: title, product, path, date
3. Ask: "Update one of these, or create new?"

### Search Locations for Pricing Strategy

- `pricing/`
- `strategy/`
- `gtm/`
- `business/`

---

Create a **complete Pricing Strategy** for the specified product or feature.

## V2V Phase

**Phase 2: Strategic Decisions** - Pricing is a critical commercial decision that must be made before commitment.

**Prerequisites**: Phase 1 complete (market analysis, competitive landscape), Value proposition clear
**Outputs used by**: Phase 3 (GTM strategy, sales enablement), Business case

## Output Structure

Generate a comprehensive pricing strategy with the following sections:

### 1. Executive Summary
- Pricing model recommendation
- Price point summary
- Expected revenue impact
- Competitive positioning
- Implementation timeline

### 2. Market & Competitive Analysis
- Market pricing trends
- Competitive pricing landscape
- Price sensitivity analysis
- Willingness to pay research

### 3. Value Proposition Alignment
- Core value delivered
- Value quantification
- Value-based pricing rationale
- Price-to-value ratio

### 4. Pricing Model Selection

#### Model Options Considered
| Model | Pros | Cons | Fit |
|-------|------|------|-----|
| Per user | [Pros] | [Cons] | High/Med/Low |
| Per usage | [Pros] | [Cons] | High/Med/Low |
| Flat rate | [Pros] | [Cons] | High/Med/Low |
| Tiered | [Pros] | [Cons] | High/Med/Low |

#### Selected Model
- Model type
- Rationale
- Alignment with customer buying behavior

### 5. Price Points & Tiers

| Tier | Price | Target Segment | Key Features |
|------|-------|----------------|--------------|
| [Tier 1] | $X/mo | [Segment] | [Features] |
| [Tier 2] | $X/mo | [Segment] | [Features] |
| [Tier 3] | $X/mo | [Segment] | [Features] |

### 6. Packaging Strategy
- What's included in each tier
- Feature differentiation
- Upsell paths
- Add-on pricing

### 7. Discount Policy & Governance
| Discount Type | Maximum | Approval Required | Criteria |
|---------------|---------|-------------------|----------|
| Annual prepay | X% | [Level] | [Criteria] |
| Volume | X% | [Level] | [Criteria] |
| Competitive | X% | [Level] | [Criteria] |
| Strategic | X% | [Level] | [Criteria] |

### 8. Geographic/Segment Variations
| Region/Segment | Price Adjustment | Rationale |
|----------------|------------------|-----------|
| [Region] | +/- X% | [Reason] |

### 9. Competitive Comparison
| Competitor | Their Price | Our Price | Positioning |
|------------|-------------|-----------|-------------|
| [Competitor 1] | $X | $X | Premium/Parity/Value |

### 10. Financial Impact Analysis
| Scenario | Assumptions | Revenue Impact |
|----------|-------------|----------------|
| Conservative | [Assumptions] | $X |
| Base case | [Assumptions] | $X |
| Optimistic | [Assumptions] | $X |

### 11. Implementation Plan
| Phase | Timeline | Activities |
|-------|----------|------------|
| Preparation | [Dates] | [Activities] |
| Rollout | [Dates] | [Activities] |
| Optimization | [Dates] | [Activities] |

### 12. Monitoring & Adjustment Triggers
| Metric | Threshold | Action |
|--------|-----------|--------|
| Win rate | < X% | [Action] |
| Deal size | < $X avg | [Action] |
| Churn | > X% | [Action] |

## Instructions

1. Ask about target segments and competitive context if not provided
2. Reference any market or financial documents provided via @file syntax
3. Ensure pricing aligns with value delivered
4. Include sensitivity analysis
5. Save as markdown file
6. Offer to create presentation version using /present
