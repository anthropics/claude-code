---
name: strategic-intent
description: Create or update strategic intent documentation
argument-hint: [initiative or planning period] or [update path/to/intent.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "refine" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| "create", "new", "document" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the strategic intent", "our intent" | UPDATE | 85% |
| Just initiative/period | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new strategic intent using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve vision alignment and core intent
3. Update priorities, assumptions, or constraints
4. Show diff summary

**FIND**: Check registry, then search user's folders for strategic intent docs.

---

Document **Strategic Intent** for the specified initiative or planning period.

## V2V Phase
**Phase 1: Strategic Foundation** - This skill captures the strategic direction that drives all downstream decisions.

## Output Structure

### 1. Vision Alignment
- Company vision reference
- How this strategic intent connects
- Time horizon

### 2. Strategic Intent Statement
A clear statement of what we intend to achieve:

> We will [action] for [target customers] by [approach] to achieve [outcome] within [timeframe].

### 3. Strategic Priorities
| Priority | Rationale | Investment Level |
|----------|-----------|------------------|
| [Priority 1] | [Why this matters] | High/Med/Low |
| [Priority 2] | [Why this matters] | High/Med/Low |
| [Priority 3] | [Why this matters] | High/Med/Low |

### 4. Investment Themes
| Theme | Description | % of Investment | Owner |
|-------|-------------|-----------------|-------|
| [Theme 1] | [Description] | X% | [Owner] |
| [Theme 2] | [Description] | X% | [Owner] |

### 5. Success Definition
| Outcome | Metric | Target | Timeframe |
|---------|--------|--------|-----------|
| [Outcome 1] | [Metric] | [Target] | [When] |
| [Outcome 2] | [Metric] | [Target] | [When] |

### 6. Constraints & Guardrails
- What we will NOT do
- Resource constraints
- Risk tolerance
- Non-negotiables

### 7. Key Assumptions
| Assumption | How We'll Validate | Invalidation Impact |
|------------|-------------------|---------------------|
| [Assumption 1] | [Validation approach] | High/Med/Low |
| [Assumption 2] | [Validation approach] | High/Med/Low |

### 8. Dependencies
- External dependencies
- Internal dependencies
- Cross-team coordination needed

## Instructions

1. Ask about planning horizon if not specified
2. Reference any company strategy documents provided via @file syntax
3. Ensure intent is specific enough to guide decisions
4. Include explicit constraints and guardrails
5. Save as markdown file
6. Offer to create presentation version using /present
