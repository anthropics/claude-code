---
name: decision-charter
description: Create or update a Decision Interface Charter for recurring decisions
argument-hint: [decision type] or [update path/to/charter.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| Charter ID mentioned (e.g., DIC-2026-001) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the charter", "our charter" | UPDATE | 85% |
| Just decision type | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new charter using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve charter ID and version history
3. Update decision rules, criteria, or escalation paths
4. Show diff summary

**FIND**: Check registry, then search user's folders for charters.

---

Create a **Decision Interface Charter** to govern how a recurring type of decision is made.

## V2V Phase

**Phase 2: Strategic Decisions** - Decision charters establish governance for recurring decisions at any phase.

**Prerequisites**: Decision patterns identified, need for consistency recognized
**Outputs used by**: All phases (provides decision governance)

## Purpose
Decision Interface Charters establish the "rules of engagement" for recurring decisions, ensuring consistent quality and accountability.

## Output Structure

```markdown
# Decision Interface Charter: [Decision Type]

**Charter ID**: DIC-[YYYY]-[NNN]
**Version**: 1.0
**Last Updated**: [Date]
**Charter Owner**: [Role responsible for this charter]

## Decision Scope

**Decision Type**: [What recurring decision this governs]
**Examples**:
- [Example decision 1]
- [Example decision 2]
- [Example decision 3]

**Out of Scope**:
- [What this charter does NOT cover]

## Decision Classification

**Type**: Strategic / Portfolio / Execution
**Frequency**: [How often this decision typically occurs]
**Reversibility**: Low / Medium / High
**Impact**: Low / Medium / High

## Accountable Owner

**Role**: [Role, not person name]
**Authority**: [What they can decide unilaterally]
**Constraints**: [What requires escalation or consultation]

## Decision Forum & Cadence

**Forum**: [Where this is decided - e.g., "Weekly PLT meeting"]
**Cadence**: [When - e.g., "Thursdays 2pm"]
**Quorum**: [Who must be present]
**Duration**: [Expected time allocation]

## Required Inputs

| Role | Input Required | Format | Deadline |
|------|----------------|--------|----------|
| [Role 1] | [What they provide] | [Format] | [When before decision] |
| [Role 2] | [What they provide] | [Format] | [When before decision] |
| [Role 3] | [What they provide] | [Format] | [When before decision] |

## Decision Criteria

**Ready to Decide When:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

**Quality Threshold**: [What "good enough" looks like]

## Decision Rules

**How the decision is made:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Tiebreaker**: [How to resolve if no clear answer]

## Escalation Rule

| Trigger | Escalate To | Timeline | Information Required |
|---------|-------------|----------|---------------------|
| [Trigger 1] | [Role] | [When] | [What to provide] |
| [Trigger 2] | [Role] | [When] | [What to provide] |

## Success Criteria

| Metric | Target | Timeframe | Measurement |
|--------|--------|-----------|-------------|
| Leading indicator | [Target] | T+2 weeks | [How measured] |
| Mid indicator | [Target] | T+6 weeks | [How measured] |
| Lagging indicator | [Target] | T+12 weeks | [How measured] |

## Re-decision Trigger

This decision should be revisited when:
- [Trigger 1]
- [Trigger 2]
- [Trigger 3]

## Communication Plan

| Audience | Channel | Timing | Owner |
|----------|---------|--------|-------|
| [Who needs to know] | [How] | [When] | [Who tells them] |

## Charter Review

**Review Frequency**: [How often to review this charter]
**Next Review**: [Date]
**Review Owner**: [Role]
```

## Instructions

1. Ask about the specific decision type if not clear
2. Reference any governance documents provided via @file syntax
3. Ensure accountable owner is a role, not a person
4. Include specific escalation triggers
5. Define measurable success criteria
6. Save in charters/ folder
7. Offer to create presentation version using /present
