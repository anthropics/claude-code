---
name: business-plan
description: Create or update a business plan
argument-hint: [product or business area] or [update path/to/business-plan.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "refresh" in input | UPDATE | 100% |
| File path provided (`@path/to/business-plan.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list plans" | FIND | 100% |
| "the business plan", "our plan" | UPDATE | 85% |
| Just product/business area | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new business plan using template below.

**UPDATE**:
1. Read existing plan (search if path not provided)
2. Preserve structure and strategy sections
3. Update financials, milestones, or market data
4. Show diff summary: "Updated: [sections]. Financials recalculated."

**FIND**:
1. Search paths below for business plans
2. Present results: product/area, date, path
3. Ask: "Update one of these, or create new?"

### Search Locations for Business Plans

- `business/`
- `strategy/`
- `plans/`
- `docs/business/`

---

Create a **complete Business Plan** for the specified product or business area.

## V2V Phase

**Phase 2: Strategic Decisions** - Business plans consolidate the strategic foundation into a comprehensive commercial blueprint.

**Prerequisites**: Phase 1 complete (market analysis, competitive landscape, vision)
**Outputs used by**: Phase 3 (roadmap, GTM strategy), Investment decisions

## Output Structure

Generate a comprehensive business plan with the following sections:

### 1. Executive Summary
- Business overview
- Value proposition
- Target market
- Revenue model
- Key milestones
- Investment requirements

### 2. Product/Market Overview
- Product description
- Market definition
- Problem being solved
- Solution approach

### 3. Market Opportunity Analysis
- Market size (TAM, SAM, SOM)
- Market growth rate
- Market trends
- Regulatory environment
- Market entry barriers

### 4. Customer Analysis
- Target customer segments
- Customer personas
- Customer needs and pain points
- Buying behavior
- Customer acquisition strategy

### 5. Competitive Positioning
- Competitive landscape
- Direct competitors
- Indirect competitors
- Competitive advantages
- Positioning statement

### 6. Business Model
- Value creation
- Value delivery
- Value capture
- Key partnerships
- Key resources
- Key activities

### 7. Revenue Model & Projections
| Revenue Stream | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
|----------------|--------|--------|--------|--------|--------|
| [Stream 1] | $X | $X | $X | $X | $X |
| [Stream 2] | $X | $X | $X | $X | $X |
| **Total** | $X | $X | $X | $X | $X |

### 8. Cost Structure
| Cost Category | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
|---------------|--------|--------|--------|--------|--------|
| COGS | $X | $X | $X | $X | $X |
| R&D | $X | $X | $X | $X | $X |
| Sales & Marketing | $X | $X | $X | $X | $X |
| G&A | $X | $X | $X | $X | $X |
| **Total** | $X | $X | $X | $X | $X |

### 9. Go-to-Market Approach
- Market entry strategy
- Sales strategy
- Marketing strategy
- Channel strategy
- Launch plan overview

### 10. Organizational Requirements
- Team structure
- Key roles needed
- Hiring plan
- Skills gaps

### 11. Key Milestones
| Milestone | Target Date | Success Criteria |
|-----------|-------------|------------------|
| [Milestone] | [Date] | [Criteria] |

### 12. Financial Summary
| Metric | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
|--------|--------|--------|--------|--------|--------|
| Revenue | $X | $X | $X | $X | $X |
| Gross Margin | X% | X% | X% | X% | X% |
| Operating Expense | $X | $X | $X | $X | $X |
| EBITDA | $X | $X | $X | $X | $X |
| Cash Flow | $X | $X | $X | $X | $X |

### 13. Key Risks & Mitigations
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| [Risk] | High/Med/Low | High/Med/Low | [Plan] |

### 14. Investment Requirements
- Total investment needed
- Use of funds
- Investment timeline
- Expected returns

## Instructions

1. Ask about scope and timeframe if not specified
2. Reference any strategy or market documents provided via @file syntax
3. Ensure financial projections are internally consistent
4. Be explicit about key assumptions
5. Save as markdown file
6. Offer to create presentation version using /present
