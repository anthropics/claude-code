---
name: qbr-deck
description: Create or update a Quarterly Business Review presentation
argument-hint: [quarter, e.g., Q1 2025] or [update path/to/qbr.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "refresh" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| "create", "new", "build" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the QBR", "this quarter's QBR" | UPDATE | 85% |
| Just quarter reference | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new QBR using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve historical data and metrics
3. Update performance data, highlights, or priorities
4. Show diff summary

**FIND**: Check registry, then search user's folders for QBR decks.

---

Create a **Quarterly Business Review (QBR)** for the specified quarter.

## V2V Phase

**Phase 5/6: Outcomes & Learning** - QBRs review business outcomes and feed back into strategy.

**Prerequisites**: Quarter complete, metrics available
**Outputs used by**: Phase 1 (next cycle strategic foundation), leadership decisions

## Output Structure

Generate a comprehensive QBR with the following sections:

### 1. Executive Summary
- Quarter highlights
- Key wins
- Key challenges
- Performance vs. targets
- Critical decisions needed

### 2. Key Metrics Performance

| Metric | Target | Actual | Variance | Trend |
|--------|--------|--------|----------|-------|
| Revenue | $X | $X | +/-X% | ↑/↓/→ |
| New Customers | X | X | +/-X% | ↑/↓/→ |
| Retention | X% | X% | +/-X% | ↑/↓/→ |
| NPS | X | X | +/-X | ↑/↓/→ |

### 3. Product Delivery Highlights

#### Shipped This Quarter
| Feature/Product | Impact | Adoption |
|-----------------|--------|----------|
| [Feature 1] | [Impact] | X% |

#### Delayed/Descoped
| Feature/Product | Original Date | New Date | Reason |
|-----------------|---------------|----------|--------|
| [Feature] | [Date] | [Date] | [Reason] |

### 4. Customer Wins & Losses

#### Notable Wins
| Customer | Deal Size | Why We Won |
|----------|-----------|------------|
| [Customer] | $X | [Reasons] |

#### Notable Losses
| Customer | Deal Size | Why We Lost |
|----------|-----------|-------------|
| [Customer] | $X | [Reasons] |

### 5. Market & Competitive Updates
- Market changes observed
- Competitive moves
- Implications for strategy
- Recommended responses

### 6. Financial Performance

| Metric | Plan | Actual | Variance |
|--------|------|--------|----------|
| Revenue | $X | $X | +/-X% |
| Gross Margin | X% | X% | +/-X% |
| CAC | $X | $X | +/-X% |
| LTV | $X | $X | +/-X% |

### 7. Key Learnings & Pivots
- What we learned this quarter
- Assumptions validated/invalidated
- Strategic pivots made
- Process improvements

### 8. Next Quarter Priorities

| Priority | Owner | Success Criteria | Investment |
|----------|-------|------------------|------------|
| [Priority 1] | [Owner] | [Criteria] | [Resources] |
| [Priority 2] | [Owner] | [Criteria] | [Resources] |
| [Priority 3] | [Owner] | [Criteria] | [Resources] |

### 9. Resource Needs

| Need | Justification | Investment | Timeline |
|------|---------------|------------|----------|
| [Need] | [Why] | $X or X headcount | [When] |

### 10. Risks & Blockers

| Risk/Blocker | Impact | Mitigation | Help Needed |
|--------------|--------|------------|-------------|
| [Risk] | High/Med/Low | [Plan] | [Ask] |

### 11. Asks & Decisions Needed

| Ask | Context | Decision Needed By | Recommended Decision |
|-----|---------|-------------------|---------------------|
| [Ask] | [Context] | [Date] | [Recommendation] |

### 12. Appendix
- Detailed metrics
- Supporting data
- Team updates

## Instructions

1. Ask about specific metrics to highlight if not provided
2. Reference any financial or performance documents provided via @file syntax
3. Be honest about misses, not just wins
4. Include clear asks and decisions needed
5. Save as markdown file
6. Create presentation version using /present (QBRs are typically presented)
