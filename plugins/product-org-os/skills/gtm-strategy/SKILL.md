---
name: gtm-strategy
description: Create or update a go-to-market strategy
argument-hint: [product or feature name] or [update path/to/gtm.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/gtm.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list GTM" | FIND | 100% |
| "the GTM", "our GTM strategy" | UPDATE | 85% |
| Just product/feature name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new GTM strategy using template below.

**UPDATE**:
1. Read existing GTM doc (search if path not provided)
2. Preserve unchanged sections exactly
3. Update specific sections (timeline, channels, budget)
4. Show diff summary: "Updated: [sections]. Unchanged: [sections]."

**FIND**:
1. Search paths below for GTM documents
2. Present results: title, product, launch date, path
3. Ask: "Update one of these, or create new?"

### Search Locations for GTM Strategy

- `gtm/`
- `marketing/`
- `launch/`
- `strategy/`

---

Create a **comprehensive Go-to-Market (GTM) Strategy** for the specified product or feature.

## V2V Phase

**Phase 3: Strategic Commitments** - GTM strategy is a critical commitment that follows Phase 2 decisions.

**Prerequisites**: Phase 2 complete (positioning, pricing, business case)
**Outputs used by**: Phase 4 (campaigns, sales enablement, launch)

## Output Structure

Generate a complete GTM strategy with the following sections:

### 1. Executive Summary
- Product/feature overview
- Target market
- Positioning summary
- Launch timeline
- Key success metrics

### 2. Market Analysis & Segmentation
- Total addressable market
- Market segments
- Segment prioritization
- Market trends affecting GTM

### 3. Target Customer Profiles

#### Ideal Customer Profile (ICP)
- Company characteristics
- Industry verticals
- Company size
- Technology environment
- Buying triggers

#### Buyer Personas
For each persona:
- Role and responsibilities
- Goals and challenges
- Decision criteria
- Information sources
- Objections

### 4. Positioning & Messaging Framework

#### Positioning Statement
For [target customer] who [need], [product] is a [category] that [key benefit]. Unlike [competitors], we [differentiator].

#### Key Messages
| Audience | Primary Message | Supporting Points |
|----------|-----------------|-------------------|
| [Persona 1] | [Message] | [Points] |
| [Persona 2] | [Message] | [Points] |

#### Value Proposition
- Functional value
- Emotional value
- Economic value

### 5. Competitive Differentiation
- Key competitors
- Differentiation strategy
- Win themes
- Competitive responses

### 6. Pricing & Packaging Strategy
- Pricing model
- Price points
- Packaging tiers
- Competitive pricing comparison
- Discount policy

### 7. Sales Strategy & Motion
- Sales model (self-serve, sales-assisted, enterprise)
- Sales process
- Deal qualification criteria
- Sales cycle expectations
- Territory/segment strategy

### 8. Marketing Strategy & Channels
| Channel | Purpose | Tactics | Budget | Metrics |
|---------|---------|---------|--------|---------|
| [Channel] | [Goal] | [Tactics] | $X | [KPIs] |

### 9. Partner/Channel Strategy
- Partner types
- Partner value proposition
- Partner program structure
- Channel economics

### 10. Launch Plan with Timeline
| Phase | Dates | Activities | Owner |
|-------|-------|------------|-------|
| Pre-launch | [Dates] | [Activities] | [Owner] |
| Launch | [Dates] | [Activities] | [Owner] |
| Post-launch | [Dates] | [Activities] | [Owner] |

### 11. Sales Enablement Plan
- Training requirements
- Sales tools needed
- Collateral requirements
- Demo/trial strategy

### 12. Success Metrics & KPIs
| Metric | Target | Timeframe | Owner |
|--------|--------|-----------|-------|
| [Awareness metric] | [Target] | [When] | [Owner] |
| [Acquisition metric] | [Target] | [When] | [Owner] |
| [Revenue metric] | [Target] | [When] | [Owner] |

### 13. Budget & Resources
| Category | Investment | Timeline |
|----------|------------|----------|
| Marketing | $X | [When] |
| Sales | $X | [When] |
| Enablement | $X | [When] |
| **Total** | $X | |

## Instructions

1. Ask about launch timeline if not specified
2. Reference any market or competitive documents provided via @file syntax
3. Ensure positioning is differentiated and defensible
4. Include clear metrics for each phase
5. Save as markdown file
6. Offer to create presentation version using /present
