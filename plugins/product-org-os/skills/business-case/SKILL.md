---
name: business-case
description: Create or update a comprehensive business case
argument-hint: [initiative or investment name] or [update path/to/business-case.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/business-case.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list business cases" | FIND | 100% |
| "the business case", "our business case" | UPDATE | 85% |
| Just initiative/investment name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new business case using template below.

**UPDATE**:
1. Read existing business case (search if path not provided)
2. Preserve unchanged sections exactly
3. Update specific sections (financials, risks, assumptions)
4. Show diff summary: "Updated: [sections]. Unchanged: [sections]."
5. Note: Financial projections may need recalculation

**FIND**:
1. Search paths below for business cases
2. Present results: title, initiative, status, path
3. Ask: "Update one of these, or create new?"

### Search Locations for Business Cases

- `business/`
- `strategy/`
- `proposals/`
- `cases/`

---

Create a **comprehensive Business Case** for the specified initiative or investment.

## V2V Phase

**Phase 2: Strategic Decisions** - Business cases are the commercial filter that determines whether to proceed.

**Prerequisites**: Phase 1 complete (strategic foundation, market analysis)
**Outputs used by**: Phase 3 (roadmap, GTM commitment), Decision records

## Output Structure

Generate a complete business case with the following sections:

### 1. Executive Summary
- One paragraph recommendation
- Investment ask
- Expected return
- Timeline to value
- Key risks

### 2. Problem/Opportunity Statement
- Current state
- Problem being solved OR opportunity being captured
- Cost of inaction
- Why now?

### 3. Proposed Solution
- Solution description
- Key capabilities
- Differentiators
- Build vs buy analysis (if applicable)

### 4. Market Analysis
- Market size (TAM, SAM, SOM)
- Market trends
- Customer segments
- Growth projections

### 5. Competitive Landscape
- Key competitors
- Competitive positioning
- Differentiation strategy
- Competitive risks

### 6. Financial Projections

#### Revenue Model
| Year | Revenue | Growth Rate |
|------|---------|-------------|
| Year 1 | $X | - |
| Year 2 | $X | X% |
| Year 3 | $X | X% |

#### Cost Structure
| Category | Year 1 | Year 2 | Year 3 |
|----------|--------|--------|--------|
| Development | $X | $X | $X |
| Operations | $X | $X | $X |
| Marketing | $X | $X | $X |
| **Total** | $X | $X | $X |

#### ROI Analysis
- Investment required: $X
- Payback period: X months
- NPV: $X
- IRR: X%

### 7. Investment Requirements
- Capital expenditure
- Operating expenditure
- Resource requirements (headcount)
- Technology requirements
- Timeline of investment

### 8. Risk Analysis
| Risk | Probability | Impact | Mitigation | Residual Risk |
|------|-------------|--------|------------|---------------|
| [Risk] | High/Med/Low | High/Med/Low | [Plan] | High/Med/Low |

### 9. Implementation Timeline
| Phase | Duration | Key Deliverables | Investment |
|-------|----------|------------------|------------|
| Phase 1 | X months | [Deliverables] | $X |
| Phase 2 | X months | [Deliverables] | $X |

### 10. Success Criteria
| Metric | Target | Timeframe | Measurement Method |
|--------|--------|-----------|-------------------|
| [Metric] | [Target] | [When] | [How measured] |

### 11. Assumptions
- Key assumptions underlying the analysis
- Sensitivity of results to assumption changes

### 12. Recommendation
- Clear recommendation (proceed / don't proceed / conditional)
- Conditions or prerequisites
- Next steps if approved

## Instructions

1. Ask clarifying questions about scope and assumptions
2. Reference any market or financial documents provided via @file syntax
3. Be explicit about assumptions
4. Include sensitivity analysis for key variables
5. Save as markdown file
6. Offer to create presentation version using /present
