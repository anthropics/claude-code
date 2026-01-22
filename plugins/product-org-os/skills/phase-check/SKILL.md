---
name: phase-check
description: Assess which V2V phase an initiative is in
argument-hint: [initiative name]
---

Assess which **V2V phase** an initiative is currently in and identify what's needed to progress.

## V2V Phase

**Cross-phase** - This skill assesses phase status for any initiative at any time.

## Purpose

The V2V Operating System has 6 phases. This skill determines where an initiative currently sits, what deliverables are complete, what gaps exist, and what's needed to move forward.

## Output Structure

```markdown
# Phase Check: [Initiative Name]

**Date**: [Date]
**Initiative**: [Brief description]
**Assessed By**: [Role]

## Current Phase Determination

**Current Phase**: Phase [1-6]: [Phase Name]

**Phase Status**: [Early/Mid/Late/Complete]

## Phase Progression Summary

```
[✓] Phase 1: Strategic Foundation
[✓] Phase 2: Strategic Decisions
[→] Phase 3: Strategic Commitments  ← CURRENT
[ ] Phase 4: Coordinated Execution
[ ] Phase 5: Business Outcomes
[ ] Phase 6: Learning & Adaptation
```

## Phase-by-Phase Audit

### Phase 1: Strategic Foundation

| Deliverable | Status | Evidence/Location |
|-------------|--------|-------------------|
| Strategic Intent | [Complete/Partial/Missing] | [Link or "Not found"] |
| Market Analysis | [Complete/Partial/Missing] | [Link or "Not found"] |
| Competitive Landscape | [Complete/Partial/Missing] | [Link or "Not found"] |
| Vision Statement | [Complete/Partial/Missing] | [Link or "Not found"] |
| Target Segments | [Complete/Partial/Missing] | [Link or "Not found"] |

**Phase 1 Status**: [Complete/Incomplete]
**Gaps**: [List any missing deliverables]

### Phase 2: Strategic Decisions

| Deliverable | Status | Evidence/Location |
|-------------|--------|-------------------|
| Business Case | [Complete/Partial/Missing] | [Link or "Not found"] |
| Pricing Decision | [Complete/Partial/Missing] | [Link or "Not found"] |
| Positioning | [Complete/Partial/Missing] | [Link or "Not found"] |
| Key Decision Records | [Complete/Partial/Missing] | [Link or "Not found"] |
| Assumptions Documented | [Complete/Partial/Missing] | [Link or "Not found"] |

**Phase 2 Status**: [Complete/Incomplete]
**Gaps**: [List any missing deliverables]

### Phase 3: Strategic Commitments

| Deliverable | Status | Evidence/Location |
|-------------|--------|-------------------|
| Product Roadmap | [Complete/Partial/Missing] | [Link or "Not found"] |
| GTM Strategy | [Complete/Partial/Missing] | [Link or "Not found"] |
| Launch Plan | [Complete/Partial/Missing] | [Link or "Not found"] |
| PRD/Requirements | [Complete/Partial/Missing] | [Link or "Not found"] |
| Commitment Check | [Complete/Partial/Missing] | [Link or "Not found"] |

**Phase 3 Status**: [Complete/Incomplete]
**Gaps**: [List any missing deliverables]

### Phase 4: Coordinated Execution

| Deliverable | Status | Evidence/Location |
|-------------|--------|-------------------|
| Campaign Brief | [Complete/Partial/Missing] | [Link or "Not found"] |
| Sales Enablement | [Complete/Partial/Missing] | [Link or "Not found"] |
| Launch Readiness | [Complete/Partial/Missing] | [Link or "Not found"] |
| Stakeholder Briefs | [Complete/Partial/Missing] | [Link or "Not found"] |

**Phase 4 Status**: [Complete/Incomplete/Not Started]
**Gaps**: [List any missing deliverables]

### Phase 5: Business & Customer Outcomes

| Deliverable | Status | Evidence/Location |
|-------------|--------|-------------------|
| Customers Onboarded | [Yes/No/In Progress] | [Metrics] |
| Value Realization Tracked | [Yes/No/In Progress] | [Link or "Not measured"] |
| Customer Health Monitored | [Yes/No/In Progress] | [Link or "Not measured"] |
| Success Metrics Measured | [Yes/No/In Progress] | [Link or "Not measured"] |

**Phase 5 Status**: [Complete/Incomplete/Not Started]
**Gaps**: [List any missing deliverables]

### Phase 6: Learning & Adaptation

| Deliverable | Status | Evidence/Location |
|-------------|--------|-------------------|
| Outcome Review | [Complete/Partial/Missing] | [Link or "Not conducted"] |
| Assumptions Validated | [Complete/Partial/Missing] | [Link or "Not updated"] |
| Learnings Documented | [Complete/Partial/Missing] | [Link or "Not captured"] |
| Context Registry Updated | [Complete/Partial/Missing] | [Link or "Not updated"] |

**Phase 6 Status**: [Complete/Incomplete/Not Started]
**Gaps**: [List any missing deliverables]

## Critical Gaps

### Blocking Progression
These gaps prevent moving to the next phase:

| Gap | Current Phase | Required For | Impact |
|-----|---------------|--------------|--------|
| [Missing deliverable] | [Phase N] | [Phase N+1] | [What's blocked] |
| [Missing deliverable] | [Phase N] | [Phase N+1] | [What's blocked] |

### Non-Blocking But Important
These gaps should be addressed but don't block progression:

| Gap | Phase | Recommended Action |
|-----|-------|-------------------|
| [Gap description] | [Phase] | [Action] |
| [Gap description] | [Phase] | [Action] |

## Phase Transition Readiness

### Ready for Next Phase?

**Next Phase**: Phase [N+1]: [Phase Name]

**Prerequisites Met**: [Yes/No/Partial]

| Prerequisite | Status | Notes |
|--------------|--------|-------|
| [Prerequisite 1] | [Met/Not Met] | [Details] |
| [Prerequisite 2] | [Met/Not Met] | [Details] |
| [Prerequisite 3] | [Met/Not Met] | [Details] |

**Transition Recommendation**: [Ready to proceed/Address gaps first/Not ready]

## Risk Assessment

| Risk | Phase | Likelihood | Impact | Mitigation |
|------|-------|------------|--------|------------|
| [Risk from skipping deliverable] | [Phase] | High/Med/Low | High/Med/Low | [Action] |
| [Risk from gap] | [Phase] | Likelihood | Impact | [Action] |

## Recommended Actions

### Immediate (To Complete Current Phase)
1. [Action to complete current phase]
2. [Action to complete current phase]

### Next (To Enable Phase Transition)
1. [Action for phase transition]
2. [Action for phase transition]

### Suggested Skills to Run
- `/[skill]` - [Purpose]
- `/[skill]` - [Purpose]

## V2V Flow Visualization

```
Phase 1          Phase 2          Phase 3          Phase 4          Phase 5          Phase 6
Strategic    →   Strategic    →   Strategic    →   Coordinated  →   Business     →   Learning
Foundation       Decisions        Commitments      Execution        Outcomes         Loop

[STATUS]         [STATUS]         [STATUS]         [STATUS]         [STATUS]         [STATUS]
```
```

## Instructions

1. Ask what initiative to assess
2. Review available documentation and context
3. Audit deliverables for each phase
4. Determine current phase and status
5. Identify gaps blocking progression
6. Assess readiness for next phase
7. Provide recommendations and suggested skills

## When to Use

- At the start of work on any initiative
- Before making commitments (to verify Phase 1 & 2 complete)
- When inheriting an initiative from someone else
- During portfolio reviews
- When progress seems blocked

## Related Skills

- `/commitment-check` - Detailed Phase 3 readiness
- `/ownership-map` - Validate ownership across phases
- `/portfolio-status` - See all initiatives and phases

## Phase Descriptions

| Phase | Name | Purpose | Key Question |
|-------|------|---------|--------------|
| 1 | Strategic Foundation | Understand the market and opportunity | "Where should we play?" |
| 2 | Strategic Decisions | Make commercial and positioning choices | "Is this viable?" |
| 3 | Strategic Commitments | Lock in roadmap, GTM, requirements | "Are we committed?" |
| 4 | Coordinated Execution | Execute with cross-functional coordination | "Are we ready to launch?" |
| 5 | Business Outcomes | Realize customer value and track results | "Did it work?" |
| 6 | Learning Loop | Extract learnings and feed back | "What did we learn?" |

## Operating Principle

> "You can't skip phases without accumulating risk debt. Know where you are, know what's missing, close the gaps before moving forward."
