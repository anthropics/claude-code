---
name: market-analysis
description: Create or update a market analysis
argument-hint: [market or segment name] or [update path/to/market-analysis.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "refresh", "revise" in input | UPDATE | 100% |
| File path provided (`@path/to/analysis.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list analyses" | FIND | 100% |
| "the market analysis", "our analysis" | UPDATE | 85% |
| Just market/segment name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new market analysis using template below.

**UPDATE**:
1. Read existing analysis (search if path not provided)
2. Preserve structure and methodology
3. Update market sizing, trends, or competitive sections with new data
4. Show diff summary: "Updated: [sections] with [year] data."

**FIND**:
1. Search paths below for market analysis documents
2. Present results: market, date, path
3. Ask: "Update one of these, or create new?"

### Search Locations for Market Analysis

- `market/`
- `research/`
- `strategy/`
- `analysis/`

---

Create a **comprehensive Market Analysis** for the specified market or segment.

## V2V Phase

**Phase 1: Strategic Foundation** - Market analysis establishes the factual foundation for strategic decisions.

**Prerequisites**: Market opportunity or hypothesis identified
**Outputs used by**: Phase 2 (business case, positioning), Phase 1 (vision, segments)

## Output Structure

Generate a complete market analysis with the following sections:

### 1. Executive Summary
- Market definition
- Market size summary
- Key trends
- Growth opportunities
- Recommendations

### 2. Market Definition & Scope
- What is included in this market
- What is excluded
- Adjacent markets
- Market boundaries

### 3. Market Size

#### Total Addressable Market (TAM)
- Size: $X billion
- Calculation methodology
- Data sources

#### Serviceable Addressable Market (SAM)
- Size: $X billion
- Geographic limitations
- Segment focus
- Technology constraints

#### Serviceable Obtainable Market (SOM)
- Size: $X billion
- Realistic capture rate
- Competitive factors
- Timeline to capture

### 4. Market Segmentation

| Segment | Size | Growth Rate | Attractiveness | Our Fit |
|---------|------|-------------|----------------|---------|
| [Segment 1] | $X | X% | High/Med/Low | High/Med/Low |
| [Segment 2] | $X | X% | High/Med/Low | High/Med/Low |

### 5. Customer Needs Analysis

| Need | Importance | Current Solutions | Gap/Opportunity |
|------|------------|-------------------|-----------------|
| [Need 1] | Critical/Important/Nice | [Solutions] | [Gap] |
| [Need 2] | Critical/Important/Nice | [Solutions] | [Gap] |

### 6. Buying Behavior & Journey

#### Buying Process
1. [Stage 1]: Trigger, activities, stakeholders
2. [Stage 2]: Trigger, activities, stakeholders
3. [Stage 3]: Trigger, activities, stakeholders

#### Key Buying Criteria
| Criteria | Weight | Trend |
|----------|--------|-------|
| [Criteria 1] | X% | Increasing/Stable/Decreasing |

### 7. Market Trends & Dynamics

#### Macro Trends
| Trend | Impact on Market | Timeframe |
|-------|------------------|-----------|
| [Trend 1] | [Impact] | [When] |

#### Technology Trends
| Trend | Impact on Market | Timeframe |
|-------|------------------|-----------|
| [Trend 1] | [Impact] | [When] |

### 8. Regulatory Considerations
- Current regulations
- Pending regulations
- Compliance requirements
- Regulatory risks

### 9. Competitive Landscape Overview
- Market structure (fragmented/consolidated)
- Key players
- Market share distribution
- Entry barriers

### 10. Growth Opportunities

| Opportunity | Market Size | Investment | Fit | Priority |
|-------------|-------------|------------|-----|----------|
| [Opportunity 1] | $X | High/Med/Low | High/Med/Low | 1/2/3 |

### 11. Market Entry/Expansion Recommendations

#### Recommended Strategy
- Entry point
- Target segments
- Positioning
- Go-to-market approach

#### Investment Required
- Resources
- Timeline
- Expected returns

## Instructions

1. Ask about specific segments or geographies to focus on if needed
2. Use WebSearch for current market data
3. Reference any existing research provided via @file syntax
4. Provide actionable recommendations
5. Save as markdown file
6. Offer to create presentation version using /present
