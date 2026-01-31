---
name: relevant-learnings
description: Find past learnings applicable to current work
argument-hint: [topic or situation]
---

Search the **learnings index** for wisdom from past experiences that applies to current work.

## V2V Phase

**Phase 6: Learning & Adaptation** - This skill surfaces learnings to inform new work.

**Prerequisites**: Learnings captured from retrospectives and outcome reviews
**Outputs used by**: All phases (applies institutional knowledge to new work)

## Purpose

The organization accumulates learnings from retrospectives, outcome reviews, and decision audits. This skill surfaces relevant learnings before repeating past mistakes or missing known opportunities.

## When to Use

Invoke `/relevant-learnings [topic]` when:
- Starting a new project in a familiar area
- Making a decision where past experience may help
- Facing a challenge that others may have encountered
- Onboarding to an area and wanting institutional knowledge
- Before a retrospective (to see if patterns are repeating)

## Process

### 1. Parse the Query

Accept a topic, situation, or question with optional flags:
- `/relevant-learnings pricing strategy`
- `/relevant-learnings launching to enterprise`
- `/relevant-learnings team scaling challenges --include-demo`
- `/relevant-learnings customer churn --demo-only`

**Flags**:
- `--include-demo` - Include demo learnings (marked with `[DEMO]`)
- `--demo-only` - Show only demo learnings (for testing/learning)

### 1b. Check for Production Data (Demo Filtering)

**Before searching**, determine if production learnings exist:

1. Check `context/learnings/index.md` for non-demo entries
2. Apply demo filtering rule:
   | Production Data? | Flag | Behavior |
   |-----------------|------|----------|
   | No | (any) | Include demo with `[DEMO]` markers |
   | Yes | (none) | **Exclude demo data**, show excluded count |
   | Yes | `--include-demo` | Include demo with `[DEMO]` markers |
   | (any) | `--demo-only` | Only demo data |

3. Demo data is identified by:
   - ID contains "DEMO" (e.g., `L-DEMO-001`)
   - Source document contains "DEMO"

### 2. Search Learnings Index

Read `context/learnings/index.md` and search for:
- Keyword matches in learning text
- Tag matches
- Category matches
- Source document matches

### 3. Rank by Relevance

Prioritize learnings by:
1. Direct keyword match
2. High confidence learnings
3. Recent learnings (more likely still relevant)
4. Multiple tag matches

### 4. Present Findings

```markdown
## Relevant Learnings: [Topic]

*Found [N] learnings related to "[topic]"*

### Highly Relevant

#### L-[NNN]: [Learning Title]
- **Learning**: [Clear statement of what was learned]
- **Source**: [Retrospective/Outcome Review] for [ID]
- **Date**: [When captured]
- **Confidence**: [High/Medium/Low]
- **Context**: [Brief background]
- **Application**: [How to apply this now]

[Repeat for top 3-5 highly relevant]

### Also Related

| ID | Learning | Source | Confidence |
|----|----------|--------|------------|
| L-[NNN] | [Brief learning] | [Source] | [Confidence] |

[List additional related learnings]

### Patterns Observed

Based on these learnings, common patterns emerge:
- [Pattern 1]
- [Pattern 2]

### Recommendations

For your current work on [topic]:
1. [Recommendation based on learnings]
2. [Recommendation based on learnings]
3. [Recommendation based on learnings]

### Learnings to Validate

Some learnings may need re-validation for your context:
- L-[NNN]: [Learning] — Consider validating because: [Reason]
```

### 5. Offer to Drill Down

If user wants more detail on any learning:
- Read the full source document
- Provide complete context and evidence
- Show how the learning was derived

## Instructions

1. Accept topic/situation from user (required)
2. Read `context/learnings/index.md`
3. Search and rank learnings by relevance
4. Present top findings with context and application
5. Identify patterns across multiple learnings
6. Provide actionable recommendations
7. Note any learnings that may need re-validation
8. Offer to read source documents for more detail

## If No Learnings Found

```markdown
## Relevant Learnings: [Topic]

No learnings found for "[topic]" in the learnings index.

This could mean:
1. This is a new area without documented learnings
2. Try different keywords: [suggest alternatives]
3. The learnings index may need to be updated

**Recommendation**: After completing work in this area, use `/retrospective` to capture learnings for future reference.
```

## Learning Categories

Learnings are categorized as:
- **Strategy & Bets** — Strategic decision-making
- **Product Development** — Building products
- **Go-to-Market** — Launching and selling
- **Customer & Market** — Customer and market dynamics
- **Process & Operations** — How we work

Use category context to improve recommendations.
