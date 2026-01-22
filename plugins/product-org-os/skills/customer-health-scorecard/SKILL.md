---
name: customer-health-scorecard
description: Create or update a customer health scorecard
argument-hint: [customer name or segment] or [update path/to/scorecard.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "refresh" in input | UPDATE | 100% |
| File path provided (`@path/to/scorecard.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list scorecards" | FIND | 100% |
| "the scorecard", "[Customer] health" | UPDATE | 85% |
| Just customer name/segment | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new health scorecard using template below.

**UPDATE**:
1. Read existing scorecard (search if path not provided)
2. Preserve structure, update metrics with new data
3. Add new month to Historical Trend
4. Recalculate health scores
5. Show diff summary: "Updated scores. Previous: X/100 → Current: Y/100."

**FIND**:
1. Search paths below for health scorecards
2. Present results: customer, current score, last updated
3. Ask: "Update one of these, or create new?"

### Search Locations for Health Scorecards

- `customers/`
- `health/`
- `customer-success/`
- `accounts/`

---

Create a **Customer Health Scorecard** for the specified customer or segment.

## V2V Phase
**Phase 5: Business & Customer Outcomes** - This skill tracks customer health indicators.

## Output Structure

### 1. Overall Health Score
**Score: X/100** [🟢 Healthy / 🟡 At Risk / 🔴 Critical]

| Component | Weight | Score | Weighted Score |
|-----------|--------|-------|----------------|
| Engagement | X% | X/100 | X |
| Adoption | X% | X/100 | X |
| Support | X% | X/100 | X |
| Relationship | X% | X/100 | X |
| **Total** | 100% | | X/100 |

### 2. Engagement Metrics

| Metric | Current | Target | Trend | Score |
|--------|---------|--------|-------|-------|
| DAU/MAU | X% | X% | ↑/↓/→ | X/100 |
| Session frequency | X/week | X/week | ↑/↓/→ | X/100 |
| Session duration | X min | X min | ↑/↓/→ | X/100 |
| Feature usage breadth | X% | X% | ↑/↓/→ | X/100 |

### 3. Adoption Metrics

| Metric | Current | Target | Trend | Score |
|--------|---------|--------|-------|-------|
| Activated users | X% | X% | ↑/↓/→ | X/100 |
| Use cases live | X/X | X/X | ↑/↓/→ | X/100 |
| Integration depth | X | X | ↑/↓/→ | X/100 |
| Admin engagement | X | X | ↑/↓/→ | X/100 |

### 4. Support Metrics

| Metric | Current | Target | Trend | Score |
|--------|---------|--------|-------|-------|
| Ticket volume | X/month | X/month | ↑/↓/→ | X/100 |
| Resolution time | X hours | X hours | ↑/↓/→ | X/100 |
| Escalations | X | X | ↑/↓/→ | X/100 |
| Satisfaction (CSAT) | X% | X% | ↑/↓/→ | X/100 |

### 5. Relationship Metrics

| Metric | Current | Trend | Score |
|--------|---------|-------|-------|
| Executive sponsor engaged | Yes/No | - | X/100 |
| Champion identified | Yes/No | - | X/100 |
| QBR participation | X% | ↑/↓/→ | X/100 |
| NPS score | X | ↑/↓/→ | X/100 |

### 6. Expansion Signals

| Signal | Status | Implication |
|--------|--------|-------------|
| Approaching usage limits | 🟢/🟡/🔴 | [Opportunity/Risk] |
| New use case interest | 🟢/🟡/🔴 | [Opportunity/Risk] |
| Team growth | 🟢/🟡/🔴 | [Opportunity/Risk] |
| Contract renewal approaching | 🟢/🟡/🔴 | [Opportunity/Risk] |

### 7. Churn Risk Indicators

| Indicator | Status | Impact | Action |
|-----------|--------|--------|--------|
| Usage decline | 🟢/🟡/🔴 | High/Med/Low | [Action] |
| Champion departure | 🟢/🟡/🔴 | High/Med/Low | [Action] |
| Support escalations | 🟢/🟡/🔴 | High/Med/Low | [Action] |
| Competitive evaluation | 🟢/🟡/🔴 | High/Med/Low | [Action] |

### 8. Action Recommendations

**Immediate (This Week):**
| Action | Owner | Due Date |
|--------|-------|----------|
| [Action] | [Owner] | [Date] |

**This Month:**
| Action | Owner | Due Date |
|--------|-------|----------|
| [Action] | [Owner] | [Date] |

### 9. Historical Trend

| Month | Health Score | Key Events |
|-------|--------------|------------|
| [Month -3] | X/100 | [Events] |
| [Month -2] | X/100 | [Events] |
| [Month -1] | X/100 | [Events] |
| Current | X/100 | [Events] |

## Instructions

1. Ask about specific customer if not specified
2. Reference any customer data provided via @file syntax
3. Include both leading and lagging indicators
4. Provide specific, actionable recommendations
5. Save as markdown file
6. Offer to create presentation version using /present
