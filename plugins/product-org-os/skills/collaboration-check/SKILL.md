---
name: collaboration-check
description: Create or update a RACI and stakeholder consultation validation
argument-hint: [decision or initiative] or [update path/to/check.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "recheck", "add stakeholders" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| "create", "new", "validate" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the collaboration check", "our RACI" | UPDATE | 85% |
| Just decision/initiative | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new collaboration check using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve RACI matrix and consultation history
3. Update stakeholder status or add new stakeholders
4. Show diff summary

**FIND**: Check registry, then search user's folders for collaboration checks.

---

Validate **stakeholder consultation and RACI clarity** for a decision or initiative, enforcing Principle #6 (Collaborative Excellence).

## V2V Phase

**Cross-phase** - This skill validates collaborative excellence at any phase, especially before Phase 2 decisions and Phase 3 commitments.

## Purpose

Collaborative Excellence means the right people provide input at the right time. This skill validates that stakeholders were properly consulted, RACI is clear, and no one will be surprised by the decision.

## Output Structure

```markdown
# Collaboration Check: [Subject]

**Date**: [Date]
**Subject**: [Decision/Initiative being validated]
**Current V2V Phase**: [Phase 1-6]
**Decision Owner**: [Name/Role - the "A" in RACI]

## RACI Matrix

| Stakeholder | Role | RACI | Consulted? | Input Incorporated? |
|-------------|------|------|------------|---------------------|
| [Name/Role] | [Function] | A (Accountable) | N/A | N/A |
| [Name/Role] | [Function] | R (Responsible) | Yes/No | Yes/No/Partial |
| [Name/Role] | [Function] | C (Consulted) | Yes/No | Yes/No/Partial |
| [Name/Role] | [Function] | C (Consulted) | Yes/No | Yes/No/Partial |
| [Name/Role] | [Function] | I (Informed) | Pending | N/A |

### RACI Definitions
- **A (Accountable)**: Single person who can say yes/no - there must be exactly ONE
- **R (Responsible)**: People doing the work
- **C (Consulted)**: People whose input should be sought before deciding
- **I (Informed)**: People who need to know after deciding

## Stakeholder Consultation Audit

### Who Should Have Been Consulted?

| Stakeholder | Why Their Input Matters | Was Consulted? | Input Summary |
|-------------|-------------------------|----------------|---------------|
| [Role/Name] | [Impact on their area] | Yes/No | [Brief summary or "Not consulted"] |
| [Role/Name] | [Impact on their area] | Yes/No | [Brief summary or "Not consulted"] |
| [Role/Name] | [Impact on their area] | Yes/No | [Brief summary or "Not consulted"] |

### Consultation Quality

| Stakeholder | Timing | Method | Adequate? |
|-------------|--------|--------|-----------|
| [Role] | [Early/Mid/Late/Not at all] | [Meeting/Async/Doc review] | [Yes/No] |
| [Role] | [Timing] | [Method] | [Yes/No] |

## Impact Analysis

### Who Is Affected By This Decision?

| Affected Party | How Affected | Severity | Were They Consulted? |
|----------------|--------------|----------|---------------------|
| [Team/Function] | [Description of impact] | High/Med/Low | Yes/No |
| [Team/Function] | [Description of impact] | High/Med/Low | Yes/No |
| [Customer segment] | [Description of impact] | High/Med/Low | Yes/No |

### Surprise Risk Assessment

**Will anyone be surprised by this decision?**

| Stakeholder | Surprise Risk | Reason | Mitigation |
|-------------|---------------|--------|------------|
| [Role/Team] | High/Med/Low | [Why they might be surprised] | [How to address] |
| [Role/Team] | High/Med/Low | [Reason] | [Mitigation] |

## Cross-Functional Dependencies

| Dependency | Owner | Consulted? | Commitment Obtained? |
|------------|-------|------------|---------------------|
| [Engineering capacity] | [Name] | Yes/No | Yes/No |
| [Marketing support] | [Name] | Yes/No | Yes/No |
| [Sales readiness] | [Name] | Yes/No | Yes/No |
| [Support preparation] | [Name] | Yes/No | Yes/No |

## Communication Plan

### Before Decision (Consultation)
| Stakeholder | Method | When | Owner |
|-------------|--------|------|-------|
| [Role] | [Meeting/Doc/Async] | [Timing] | [Who will reach out] |

### After Decision (Inform)
| Stakeholder | Method | When | Owner |
|-------------|--------|------|-------|
| [Role] | [Email/Meeting/Announcement] | [Timing] | [Who will communicate] |

## Validation Checklist

### RACI Clarity
- [ ] Exactly ONE person is Accountable
- [ ] All Responsible parties are identified
- [ ] All necessary Consulted parties are listed
- [ ] Informed parties are identified for post-decision

### Consultation Quality
- [ ] Consulted parties were engaged BEFORE decision was made
- [ ] Input was genuinely considered (not just checkbox)
- [ ] Disagreements were documented and addressed
- [ ] Timing was appropriate (not too late)

### Surprise Prevention
- [ ] No high-impact stakeholder will be surprised
- [ ] Cross-functional dependencies have been discussed
- [ ] Commitments from other teams are explicit

## Red Flags

- [ ] Multiple "Accountable" parties (must be exactly one)
- [ ] Key stakeholders consulted after decision was made
- [ ] Affected parties not in RACI at all
- [ ] "Consulted" but input was ignored without explanation
- [ ] Dependencies assumed without explicit commitment

## Assessment

**Collaboration Score**: [Strong/Adequate/Weak]

**Rationale**: [Why this assessment]

## Recommendations

1. [Stakeholder to consult before proceeding]
2. [RACI clarification needed]
3. [Communication action required]
```

## Instructions

1. Ask what decision or initiative to validate
2. Identify the decision owner (the single "A")
3. Build the RACI matrix
4. Audit stakeholder consultation
5. Assess who is affected and surprise risk
6. Document cross-functional dependencies
7. Validate against checklist
8. Provide assessment and recommendations

## Validation Questions

- Who has the authority to say yes/no? (Must be ONE person)
- Who should have provided input before deciding?
- Who will be affected by this decision?
- Will anyone be surprised?

## Red Flag Triggers

Immediately flag if:
- More than one person is "Accountable"
- High-impact stakeholders were not consulted
- Consultation happened after the decision was effectively made
- Teams will be surprised by commitments affecting them

## When to Use

- Before finalizing a `/decision-record`
- Before approving a `/commitment-check`
- When planning cross-functional initiatives
- Before major announcements

## Related Skills

- `/decision-record` - Should include stakeholders consulted
- `/handoff` - Context for delegation
- `/stakeholder-brief` - Communication to stakeholders

## Operating Principle

> "Collaboration doesn't mean consensus. It means the right people had input at the right time, and no one is surprised."
