---
name: competitive-landscape
description: Create or update a competitive landscape analysis
argument-hint: [market or product area] or [update path/to/competitive.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "refresh", "revise" in input | UPDATE | 100% |
| File path provided (`@path/to/competitive.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list landscapes" | FIND | 100% |
| "the competitive landscape", "our competitive analysis" | UPDATE | 85% |
| Just market/product area | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new competitive landscape using template below.

**UPDATE**:
1. Read existing landscape (search if path not provided)
2. Preserve structure and historical data
3. Update competitor profiles, pricing, or feature comparisons
4. Add new competitors if discovered
5. Show diff summary: "Updated: [competitors]. Added: [new]. Unchanged: [others]."

**FIND**:
1. Search paths below for competitive documents
2. Present results: market, date, path
3. Ask: "Update one of these, or create new?"

### Search Locations for Competitive Landscape

- `competitive/`
- `market/`
- `research/`
- `strategy/`

---

Create a **comprehensive Competitive Landscape Analysis** for the specified market or product area.

## V2V Phase

**Phase 1: Strategic Foundation** - Competitive understanding is essential before making strategic bets.

**Prerequisites**: Market definition established
**Outputs used by**: Phase 2 (positioning, pricing), Phase 3 (differentiation in GTM)

## Output Structure

Generate a complete competitive analysis with the following sections:

### 1. Executive Summary
- Market overview
- Key competitors identified
- Our competitive position
- Strategic recommendations
- Priority actions

### 2. Market Overview
- Market definition
- Market size and growth
- Key trends
- Market dynamics
- Regulatory factors

### 3. Competitor Profiles

For each major competitor:

#### [Competitor Name]
- **Overview**: Company background, size, funding
- **Product**: Key offerings, recent releases
- **Positioning**: How they position themselves
- **Target Market**: Who they sell to
- **Pricing**: Pricing model and points
- **Strengths**: Key advantages
- **Weaknesses**: Key vulnerabilities
- **Strategy**: Where they're headed
- **Threat Level**: High/Medium/Low

### 4. Feature Comparison Matrix

| Feature | Us | Competitor A | Competitor B | Competitor C |
|---------|----|--------------|--------------|--------------|
| [Feature 1] | ✓/✗/◐ | ✓/✗/◐ | ✓/✗/◐ | ✓/✗/◐ |
| [Feature 2] | ✓/✗/◐ | ✓/✗/◐ | ✓/✗/◐ | ✓/✗/◐ |

Legend: ✓ = Strong, ◐ = Partial, ✗ = Missing

### 5. Pricing Comparison

| Competitor | Model | Entry Price | Mid-Tier | Enterprise |
|------------|-------|-------------|----------|------------|
| Us | [Model] | $X | $X | $X |
| [Competitor A] | [Model] | $X | $X | $X |

### 6. Positioning Comparison

| Competitor | Primary Message | Target Buyer | Key Differentiator |
|------------|-----------------|--------------|-------------------|
| Us | [Message] | [Buyer] | [Differentiator] |
| [Competitor A] | [Message] | [Buyer] | [Differentiator] |

### 7. Strengths & Weaknesses Analysis

#### Our Strengths vs. Competition
| Strength | Against Whom | How to Leverage |
|----------|--------------|-----------------|
| [Strength] | [Competitors] | [Action] |

#### Our Weaknesses vs. Competition
| Weakness | Against Whom | How to Address |
|----------|--------------|----------------|
| [Weakness] | [Competitors] | [Action] |

### 8. Market Share Analysis
| Player | Est. Market Share | Trend | Notes |
|--------|-------------------|-------|-------|
| [Company] | X% | ↑/↓/→ | [Notes] |

### 9. Competitive Trends
- Emerging competitors
- Technology shifts
- Go-to-market changes
- Consolidation activity
- Pricing pressure

### 10. Win/Loss Patterns
| Competitor | Win Rate | Common Win Reasons | Common Loss Reasons |
|------------|----------|-------------------|---------------------|
| [Competitor] | X% | [Reasons] | [Reasons] |

### 11. Strategic Recommendations
1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

### 12. Battle Cards Summary
For each key competitor, one-page battle card with:
- Positioning against them
- Key talking points
- Objection handling
- Proof points to use

## Instructions

1. Ask about specific competitors to focus on if not specified
2. Use WebSearch for current competitive intelligence
3. Reference any existing competitive documents provided via @file syntax
4. Provide actionable recommendations
5. Save as markdown file
6. Offer to create presentation version using /present
