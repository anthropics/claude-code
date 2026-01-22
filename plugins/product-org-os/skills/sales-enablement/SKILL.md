---
name: sales-enablement
description: Create or update a sales enablement package
argument-hint: [product or feature name] or [update path/to/enablement.md]
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
| "the enablement", "sales package" | UPDATE | 85% |
| Just product/feature name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new enablement package using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve value proposition and positioning
3. Update objection handling, competitive info, or demo script
4. Show diff summary

**FIND**: Check registry, then search user's folders for enablement docs.

---

Create a **Sales Enablement Package** for the specified product or feature.

## V2V Phase
**Phase 4: Coordinated Execution** - This skill enables sales to effectively sell.

## Output Structure

### 1. Product Overview
- What it is (one paragraph)
- Why it matters to customers
- What's new/different

### 2. Value Proposition
- Primary value statement
- Supporting value points
- Quantified benefits (when available)

### 3. Target Customer Profile
- Ideal customer characteristics
- Industries/verticals
- Company size
- Buying triggers
- Disqualifying factors

### 4. Discovery Questions

**Understanding Current State:**
- [Question 1]
- [Question 2]
- [Question 3]

**Identifying Pain Points:**
- [Question 1]
- [Question 2]
- [Question 3]

**Quantifying Impact:**
- [Question 1]
- [Question 2]
- [Question 3]

### 5. Objection Handling

| Objection | Response | Proof Point |
|-----------|----------|-------------|
| "Too expensive" | [Response] | [Evidence] |
| "We use competitor X" | [Response] | [Evidence] |
| "Not a priority now" | [Response] | [Evidence] |
| "Need to involve others" | [Response] | [Evidence] |

### 6. Competitive Positioning

| Competitor | Their Strength | Our Response | Our Advantage |
|------------|----------------|--------------|---------------|
| [Competitor 1] | [Strength] | [Response] | [Advantage] |
| [Competitor 2] | [Strength] | [Response] | [Advantage] |

### 7. Demo Script

**Opening (2 min):**
- Hook
- Agenda

**Discovery recap (3 min):**
- Confirm understanding
- Set success criteria

**Demo flow (15 min):**
1. [Feature/capability] - ties to [pain point]
2. [Feature/capability] - ties to [pain point]
3. [Feature/capability] - ties to [pain point]

**Closing (5 min):**
- Summary of value
- Next steps
- Call to action

### 8. Case Studies / Proof Points

| Customer | Challenge | Solution | Results |
|----------|-----------|----------|---------|
| [Customer 1] | [Challenge] | [How we helped] | [Metrics] |
| [Customer 2] | [Challenge] | [How we helped] | [Metrics] |

### 9. Pricing Guidance
- Pricing model
- List prices
- Discount authority
- Bundling options
- Competitive pricing context

### 10. Resources
- Sales deck location
- Demo environment access
- Proposal templates
- Contract templates
- Technical documentation

## Instructions

1. Ask about specific competitive situations if relevant
2. Reference any product or competitive documents provided via @file syntax
3. Make objection handling specific and actionable
4. Include real customer proof points when available
5. Save as markdown file
6. Offer to create presentation version using /present
