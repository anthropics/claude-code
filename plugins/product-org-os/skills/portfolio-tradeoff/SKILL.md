---
name: portfolio-tradeoff
description: Create or update a portfolio-level tradeoff decision
argument-hint: [tradeoff description] or [update path/to/tradeoff.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "refine" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| Tradeoff ID mentioned (e.g., PT-2026-001) | UPDATE | 100% |
| "create", "new", "structure" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the tradeoff", "our tradeoff" | UPDATE | 85% |
| Just tradeoff description | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new tradeoff document using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve option analysis and stakeholder input
3. Update evaluation, recommendation, or decision record
4. Show diff summary

**FIND**: Check registry, then search user's folders for tradeoff documents.

---

Structure a **Portfolio-Level Tradeoff Decision**.

## V2V Phase

**Cross-phase** - Portfolio tradeoffs occur when Phase 2/3 commitments conflict with capacity.

**Prerequisites**: Multiple competing priorities identified, resource constraints
**Outputs used by**: Portfolio allocation, roadmap adjustments

## Purpose
Portfolio tradeoffs help the Product Leadership Team make explicit choices between competing priorities when resources are constrained.

## Output Structure

```markdown
# Portfolio Tradeoff: [Brief Description]

**Tradeoff ID**: PT-[YYYY]-[NNN]
**Date**: [Date]
**Decision Owner**: [Role - typically PLT]
**Decision Deadline**: [When decision must be made]

## The Tradeoff

**Situation**: [What's forcing this tradeoff]

**The Choice**:
> Should we [Option A] OR [Option B]?
>
> (We cannot do both because [constraint])

## Context

**Why Now**: [What's making this decision urgent]
**Constraint**: [What limits us - budget, people, time, etc.]
**Stakes**: [What's at risk with this decision]

## Option Analysis

### Option A: [Name]

**Description**: [What this option entails]

**Benefits**:
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

**Costs/Risks**:
- [Cost/Risk 1]
- [Cost/Risk 2]

**What We Give Up**: [Opportunity cost]

**Investment Required**: [Resources/budget/time]

**Success Metrics**:
| Metric | Target | Timeline |
|--------|--------|----------|
| [Metric] | [Target] | [When] |

### Option B: [Name]

**Description**: [What this option entails]

**Benefits**:
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

**Costs/Risks**:
- [Cost/Risk 1]
- [Cost/Risk 2]

**What We Give Up**: [Opportunity cost]

**Investment Required**: [Resources/budget/time]

**Success Metrics**:
| Metric | Target | Timeline |
|--------|--------|----------|
| [Metric] | [Target] | [When] |

### Option C: [Hybrid or Alternative] (if applicable)

[Similar structure]

## Evaluation Criteria

| Criterion | Weight | Option A | Option B | Option C |
|-----------|--------|----------|----------|----------|
| Strategic alignment | X% | High/Med/Low | High/Med/Low | High/Med/Low |
| Customer impact | X% | High/Med/Low | High/Med/Low | High/Med/Low |
| Revenue potential | X% | High/Med/Low | High/Med/Low | High/Med/Low |
| Execution risk | X% | High/Med/Low | High/Med/Low | High/Med/Low |
| Resource efficiency | X% | High/Med/Low | High/Med/Low | High/Med/Low |
| **Weighted Score** | 100% | [Score] | [Score] | [Score] |

## Stakeholder Perspectives

| Stakeholder | Preference | Rationale |
|-------------|------------|-----------|
| [Stakeholder 1] | Option A/B/C | [Why] |
| [Stakeholder 2] | Option A/B/C | [Why] |
| [Stakeholder 3] | Option A/B/C | [Why] |

## Recommendation

**Recommended Option**: [Option name]

**Rationale**:
[Why this option is recommended despite what we give up]

**Key Assumptions**:
1. [Assumption 1]
2. [Assumption 2]

**Conditions**:
- [Any conditions on this recommendation]

## If Recommendation is Not Accepted

**Option A implications**: [What happens if A is chosen instead]
**Option B implications**: [What happens if B is chosen instead]

## Re-decision Trigger

This tradeoff should be revisited if:
- [Condition 1]
- [Condition 2]
- [Condition 3]

## Decision Record

**Decision Made**: [To be filled after decision]
**Decision Date**: [To be filled]
**Decision Rationale**: [To be filled]
```

## Instructions

1. Ask clarifying questions about the constraint and options
2. Reference any strategy or resource documents provided via @file syntax
3. Make the tradeoff explicit and honest about costs
4. Include multiple stakeholder perspectives
5. Provide a clear recommendation with rationale
6. Save as decision record
7. Offer to create presentation version using /present
