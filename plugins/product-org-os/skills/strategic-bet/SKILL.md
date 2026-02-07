---
name: strategic-bet
description: Create or update a strategic bet with explicit assumptions
argument-hint: [bet name or area] or [update SB-2026-001]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/bet.md`) | UPDATE | 100% |
| Bet ID mentioned (`SB-2026-001`) | UPDATE | 100% |
| "create", "new", "formulate" in input | CREATE | 100% |
| "find", "search", "list bets" | FIND | 100% |
| "the bet", "our bet on" | UPDATE | 85% |
| Just bet name or area | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new strategic bet using template below.

**UPDATE**:
1. Read existing bet (search if path not provided)
2. Preserve unchanged sections exactly
3. Update assumptions (validated/invalidated), metrics, status
4. Show diff summary: "Updated: [sections]. Unchanged: [sections]."
5. Consider: Update assumption status in context registry

**FIND**:
1. Search paths below AND context registry for bets
2. Present results: ID, title, status, owner, key assumptions
3. Ask: "Update one of these, or create new?"

### Search Locations for Strategic Bets

- `bets/`
- `strategy/bets/`
- `context/bets/`
- `strategy/`

---

Formulate a **Strategic Bet** with explicit assumptions and success criteria.

## Purpose
Strategic bets articulate what we believe will create value, why we believe it, and how we'll know if we're right.

## Output Structure

```markdown
# Strategic Bet: [Bet Name]

**Bet ID**: SB-[YYYY]-[NNN]
**Owner**: [Single accountable person]
**Date Formulated**: [Date]
**Status**: Proposed / Active / Validated / Invalidated / Pivoted
**Product**: [Product name - optional, for multi-product organizations]

## The Bet

[What we believe will create value - 1-2 clear sentences]

> "We bet that [doing X] for [customer segment] will result in [outcome] because [rationale]."

## Customer Insight (Principle #3)

**Who**: [Target customer segment]
**Pain**: [What problem they have]

### Customer Evidence
| Evidence Type | Source | Date | Key Finding |
|---------------|--------|------|-------------|
| [Interview/Survey/Usage/Support] | [Source] | [Date] | [Finding] |
| [Type] | [Source] | [Date] | [Finding] |
| [Type] | [Source] | [Date] | [Finding] |

**Evidence Strength**: Strong/Moderate/Weak/None
**Confidence Level**: Low / Medium / High

*If evidence is weak, document plan to strengthen before major commitment.*

## Market Dynamics

**Timing**: Why this bet makes sense now
- [Market trend 1]
- [Market trend 2]

**Competition**: How this positions us
- [Competitive dynamic]

**Window**: How long this opportunity exists
- [Timeline consideration]

## Business Intent

**Strategic Goal**: [Which company goal this serves]
**Revenue Potential**: [Expected revenue impact]
**Strategic Value**: [Non-revenue value - positioning, learning, etc.]

## Explicit Assumptions

| # | Assumption | Confidence | How We'll Validate | Validation Timeline |
|---|------------|------------|-------------------|---------------------|
| 1 | [Assumption] | Low/Med/High | [Method] | [When] |
| 2 | [Assumption] | Low/Med/High | [Method] | [When] |
| 3 | [Assumption] | Low/Med/High | [Method] | [When] |
| 4 | [Assumption] | Low/Med/High | [Method] | [When] |

**Riskiest Assumption**: [Which assumption, if wrong, kills this bet]

## Opportunity Cost

**What we're NOT doing by choosing this bet:**
- [Alternative 1] - [What we give up]
- [Alternative 2] - [What we give up]

**Why this bet is worth the tradeoff:**
[Rationale]

## Success Criteria

| Metric | Baseline | Target | Timeframe | Measurement |
|--------|----------|--------|-----------|-------------|
| [Leading] | [Current] | [Target] | T+1 month | [How] |
| [Mid] | [Current] | [Target] | T+3 months | [How] |
| [Lagging] | [Current] | [Target] | T+6 months | [How] |

## Investment Required

**Resources**:
- Team: [Who/how many]
- Duration: [Expected timeline]
- Budget: [If applicable]

**Dependencies**:
- [Dependency 1]
- [Dependency 2]

## Scalability Consideration (Principle #8)

| Scale Level | Works? | What Changes | Investment Needed |
|-------------|--------|--------------|-------------------|
| Current (1x) | Yes | Baseline | Current |
| 2x | Yes/Partial/No | [What changes] | [Investment] |
| 10x | Yes/Partial/No | [What changes] | [Investment] |

**Scale Assumption**: [Key assumption about scale]
**Breaking Point**: [At what scale does this approach break?]

## Re-decision Points

| Checkpoint | Date | Criteria | Possible Actions |
|------------|------|----------|------------------|
| Early signal | [Date] | [What we look for] | Continue / Pivot / Stop |
| Mid-point | [Date] | [What we look for] | Double down / Maintain / Wind down |
| End | [Date] | [What we look for] | Scale / Iterate / Abandon |

## Pivot Options

If this bet doesn't work, potential pivots:
1. [Pivot option 1]
2. [Pivot option 2]
```

## Instructions

1. Ask clarifying questions about the bet if context is unclear
2. **Check prior context**: Run `/context-recall [topic]` to find related decisions and existing bets
3. **Check portfolio**: Run `/portfolio-status` to understand current strategic priorities
4. Reference any strategy or market documents provided via @file syntax
5. Ensure assumptions are explicit and testable
6. Include clear opportunity cost analysis
7. Define specific re-decision points
8. Save in strategy/bets/ folder
9. Offer to create presentation version using /present

## Context Integration

After generating the strategic bet:

1. **Offer to save**: Ask "Should I save this to the context registry? (`/context-save`)"
2. If yes, extract and save:
   - Bet ID, title, date, owner, status to `context/bets/index.md`
   - Add to `context/portfolio/active-bets.md` if status is Active
   - ALL explicit assumptions to `context/assumptions/registry.md` with validation methods
   - Full record to `context/bets/[YYYY]/[SB-ID].md`
3. Link to dependent decisions and related bets
