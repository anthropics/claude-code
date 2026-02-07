---
name: customer-value-trace
description: Create or update a trace validating work connects to customer value
argument-hint: [decision, feature, or initiative] or [update path/to/trace.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "add evidence", "strengthen" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| "create", "new", "trace" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the value trace", "our trace" | UPDATE | 85% |
| Just decision/feature/initiative | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new customer value trace using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve evidence chain and value mapping
3. Update evidence, outcomes, or assessment
4. Show diff summary

**FIND**: Check registry, then search user's folders for value traces.

---

Trace a **decision, feature, or initiative** back to customer value, validating Principle #3 (Customer Obsession).

## V2V Phase

**Cross-phase** - This skill validates customer value alignment at any phase, especially before Phase 2 decisions and Phase 3 commitments.

## Purpose

Every decision should trace to customer value. This skill validates that work is grounded in customer problems, supported by evidence, and measured by customer outcomes (not just outputs).

## Output Structure

```markdown
# Customer Value Trace: [Subject]

**Date**: [Date]
**Subject**: [Decision/Feature/Initiative being traced]
**Current V2V Phase**: [Phase 1-6]

## Customer Problem Statement

**The customer problem**: [Clear articulation of the customer problem this addresses]

**Who experiences this problem**: [Customer segment/persona]

**Problem severity**: [Critical/Significant/Moderate/Minor]

**Problem frequency**: [How often customers encounter this]

## Customer Evidence

### Direct Evidence

| Type | Source | Date | Quote/Finding |
|------|--------|------|---------------|
| [Interview/Survey/Support/Usage] | [Customer/Segment] | [Date] | "[Verbatim quote or specific data point]" |
| [Type] | [Source] | [Date] | "[Evidence]" |
| [Type] | [Source] | [Date] | "[Evidence]" |

### Indirect Evidence

| Type | Source | Finding |
|------|--------|---------|
| [Market research/Competitive/Analyst] | [Source] | [Finding] |
| [Type] | [Source] | [Finding] |

### Evidence Gaps

- [What evidence is missing]
- [What would strengthen the case]

**Evidence Strength**: [Strong/Moderate/Weak/None]

## Value Chain

```
Customer Problem → Solution Approach → Feature/Decision → Customer Benefit → Measurable Outcome
```

**Customer Problem**: [Restated]
↓
**Solution Approach**: [How we're addressing it]
↓
**Feature/Decision**: [The specific thing being built/decided]
↓
**Customer Benefit**: [What customers will experience]
↓
**Measurable Outcome**: [How we'll know customers benefited]

## Customer Outcomes (Not Outputs)

### Outputs (What We Ship)
- [Output 1]
- [Output 2]

### Outcomes (What Customers Experience)
- [Outcome 1]: [How measured]
- [Outcome 2]: [How measured]

### Leading Indicators
- [Indicator 1]: [Target]
- [Indicator 2]: [Target]

### Lagging Indicators
- [Indicator 1]: [Target]
- [Indicator 2]: [Target]

## Alternative Explanations

Could this work be justified WITHOUT customer value?

| Alternative Justification | Valid? | Risk |
|---------------------------|--------|------|
| Internal efficiency | [Yes/No] | [Risk if pursuing without customer validation] |
| Competitive response | [Yes/No] | [Risk if pursuing without customer validation] |
| Technical debt | [Yes/No] | [Risk if pursuing without customer validation] |
| Executive request | [Yes/No] | [Risk if pursuing without customer validation] |

**Assessment**: [Is customer value the PRIMARY driver, or secondary?]

## Customer Value Validation

### Validation Status

- [ ] Customer problem clearly articulated
- [ ] Direct customer evidence exists
- [ ] Customer benefit is specific and measurable
- [ ] Success measured by outcomes, not outputs
- [ ] Customer segment identified

### Red Flags

- [ ] Internal-only justification ("it will help our team")
- [ ] No customer evidence cited
- [ ] Success measured only by shipping
- [ ] Can't articulate specific customer benefit
- [ ] Building for "users" without segment clarity

## Assessment

**Customer Value Trace**: [Strong/Adequate/Weak/Missing]

**Confidence Level**: [High/Medium/Low]

**Rationale**: [Why this assessment]

## Recommendations

1. [Action to strengthen customer value trace]
2. [Additional evidence to gather]
3. [How to improve outcome measurement]
```

## Instructions

1. Ask what decision, feature, or initiative to trace
2. Identify the customer problem it addresses
3. Gather and document customer evidence
4. Map the value chain from problem to measurable outcome
5. Distinguish outputs from outcomes
6. Check for alternative (non-customer) justifications
7. Validate against the checklist
8. Provide assessment and recommendations

## Validation Questions

- What customer problem does this solve?
- What evidence supports customer need?
- How will customer benefit be measured (not just adoption)?
- Is this solving a customer problem or an internal problem?

## Red Flag Triggers

Immediately flag if:
- No customer problem can be articulated
- Zero customer evidence exists
- Success is defined only as "shipping"
- Primary justification is internal efficiency

## When to Use

- Before finalizing a `/decision-record`
- Before approving a `/business-case`
- Before committing to a `/strategic-bet`
- When prioritizing roadmap items
- When evaluating feature requests

## Related Skills

- `/feedback-recall` - Find customer evidence
- `/decision-record` - Should include customer value link
- `/outcome-review` - Validates outcomes were achieved

## Operating Principle

> "If you can't trace it to customer value, question whether you should do it. Internal convenience is not strategy."
