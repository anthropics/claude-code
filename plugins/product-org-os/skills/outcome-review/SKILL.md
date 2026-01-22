---
name: outcome-review
description: Create or update an outcome review for learning
argument-hint: [initiative or launch name] or [update path/to/review.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "add data", "finalize" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| "create", "new", "structure" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the outcome review", "our review" | UPDATE | 85% |
| Just initiative name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new outcome review using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve metrics history and prior findings
3. Update outcomes, learnings, or recommendations
4. Show diff summary

**FIND**: Check registry, then search user's folders for outcome reviews.

---

Structure an **Outcome Review** to capture learnings from an initiative.

## V2V Phase
**Phase 6: Learning & Adaptation Loop** - This skill drives continuous improvement.

## Output Structure

```markdown
# Outcome Review: [Initiative Name]

**Review Date**: [Date]
**Facilitator**: [Name]
**Participants**: [Names]
**Initiative Period**: [Start] to [End]

## Initiative Summary

**What We Did**: [Brief description]
**Original Goal**: [What we set out to achieve]
**Investment**: [Resources/time/money invested]

## Outputs vs. Outcomes (Principle #5)

**Important**: Distinguish what we SHIPPED (outputs) from what we ACHIEVED (outcomes).

### Outputs (What We Delivered)
| Output | Delivered? | Quality | Notes |
|--------|------------|---------|-------|
| [Feature/deliverable 1] | Yes/No/Partial | High/Med/Low | [Notes] |
| [Feature/deliverable 2] | Yes/No/Partial | High/Med/Low | [Notes] |
| [Feature/deliverable 3] | Yes/No/Partial | High/Med/Low | [Notes] |

### Outcomes (What Was Achieved)
| Outcome | Target | Actual | Assessment |
|---------|--------|--------|------------|
| [Customer behavior change] | [Target] | [Actual] | Met/Missed |
| [Business result] | [Target] | [Actual] | Met/Missed |
| [User benefit realized] | [Target] | [Actual] | Met/Missed |

**Key Insight**: [Did outputs lead to outcomes? Why or why not?]

## Outcome vs. Expectations

### Success Metrics Review

| Metric | Target | Actual | Variance | Assessment |
|--------|--------|--------|----------|------------|
| [Metric 1] | [Target] | [Actual] | +/-X% | Met/Missed |
| [Metric 2] | [Target] | [Actual] | +/-X% | Met/Missed |
| [Metric 3] | [Target] | [Actual] | +/-X% | Met/Missed |

### Overall Outcome
**Status**: Exceeded / Met / Partially Met / Missed

## What Worked

| Success Factor | Impact | Evidence | Replicable? |
|----------------|--------|----------|-------------|
| [Factor 1] | High/Med/Low | [Evidence] | Yes/No |
| [Factor 2] | High/Med/Low | [Evidence] | Yes/No |

## What Didn't Work

| Challenge | Impact | Root Cause | Preventable? |
|-----------|--------|------------|--------------|
| [Challenge 1] | High/Med/Low | [Cause] | Yes/No |
| [Challenge 2] | High/Med/Low | [Cause] | Yes/No |

## Assumptions Validated/Invalidated

| Assumption | Expected | Actual | Learning |
|------------|----------|--------|----------|
| [Assumption 1] | [Expected] | [Actual] | [Learning] |
| [Assumption 2] | [Expected] | [Actual] | [Learning] |

## Key Learnings

### Learning 1: [Title]
**Insight**: [What we learned]
**Evidence**: [What showed us this]
**Application**: [How to apply going forward]

### Learning 2: [Title]
[Same structure]

## Decisions to Revisit

| Original Decision | Why Revisit | Recommendation |
|-------------------|-------------|----------------|
| [Decision] | [New evidence] | Keep/Modify/Reverse |

## Recommendations

### Immediate (This Sprint/Week)
1. [Recommendation]

### Short-term (This Quarter)
1. [Recommendation]

### Long-term (Beyond Quarter)
1. [Recommendation]

## Follow-up Actions

| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action] | [Owner] | [Date] | Not Started |

## Distribution

This review should be shared with:
- [Stakeholder/team 1]
- [Stakeholder/team 2]
```

## Instructions

1. Gather outcome data before the review
2. **Check tracked assumptions**: Run `/context-recall [initiative]` to find assumptions made when the initiative started
3. Reference any relevant documents via @file syntax
4. Focus on learnings, not blame
5. Ensure every learning has an action
6. Save in reviews/ or learnings/ folder
7. Offer to create presentation version using /present

## Context Integration

After completing the outcome review:

1. **Update assumption status**: For each assumption validated/invalidated:
   - Update `context/assumptions/registry.md` with new status
   - Mark as "Validated" or "Invalidated"
   - Add actual finding and date
   - Link to this outcome review as evidence

2. **Offer to save learnings**: Ask "Should I save these learnings to the context registry? (`/context-save`)"
   - Extract each learning to `context/learnings/index.md`
   - Include evidence and application guidance

3. **Flag re-decisions**: If invalidated assumptions trigger re-decision criteria:
   - Identify affected decisions from `context/decisions/index.md`
   - Highlight that re-decision is needed
   - Offer to create a new `/decision-record` to revisit

4. **Update portfolio**: If this review relates to an active bet:
   - Update bet status in `context/portfolio/active-bets.md`
   - Move to Validated/Invalidated/Pivoted if appropriate
