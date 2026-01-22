---
name: ownership-map
description: Create or update an accountability map across V2V phases
argument-hint: [initiative or deliverable] or [update path/to/map.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "reassign" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| "create", "new", "map" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the ownership map", "our map" | UPDATE | 85% |
| Just initiative name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new ownership map using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve ownership history
3. Update owners, handoffs, or gap status
4. Show diff summary

**FIND**: Check registry, then search user's folders for ownership maps.

---

Map **end-to-end ownership** for an initiative, validating accountability chains across all V2V phases.

## V2V Phase

**Cross-phase** - This skill validates Principle #1 (End-to-End Ownership) at any phase transition, especially before Phase 3 commitments.

## Purpose

End-to-end ownership means a single person is accountable from strategic intent through customer value realization. This skill maps that accountability chain and identifies any gaps or "orphan" handoffs.

## Output Structure

```markdown
# Ownership Map: [Initiative Name]

**Date**: [Date]
**Initiative**: [Brief description]
**Current V2V Phase**: [Phase 1-6]

## Ownership Chain

| V2V Phase | Deliverable | Owner | Status |
|-----------|-------------|-------|--------|
| Phase 1: Strategic Foundation | Strategic Intent | [Name/Role] | [Complete/In Progress/Gap] |
| Phase 1: Strategic Foundation | Market Analysis | [Name/Role] | [Complete/In Progress/Gap] |
| Phase 2: Strategic Decisions | Business Case | [Name/Role] | [Complete/In Progress/Gap] |
| Phase 2: Strategic Decisions | Pricing Decision | [Name/Role] | [Complete/In Progress/Gap] |
| Phase 3: Strategic Commitments | Roadmap Item | [Name/Role] | [Complete/In Progress/Gap] |
| Phase 3: Strategic Commitments | PRD | [Name/Role] | [Complete/In Progress/Gap] |
| Phase 4: Coordinated Execution | Launch Readiness | [Name/Role] | [Complete/In Progress/Gap] |
| Phase 4: Coordinated Execution | Sales Enablement | [Name/Role] | [Complete/In Progress/Gap] |
| Phase 5: Business Outcomes | Value Realization | [Name/Role] | [Complete/In Progress/Gap] |
| Phase 5: Business Outcomes | Customer Health | [Name/Role] | [Complete/In Progress/Gap] |
| Phase 6: Learning | Outcome Review | [Name/Role] | [Complete/In Progress/Gap] |

## End-to-End Accountable Owner

**Name**: [Single person accountable for overall success]
**Role**: [Title]
**Accountability scope**: From [start] through [end outcome]

## Handoff Points

### [Handoff 1: Phase X → Phase Y]
- **From**: [Role/Name]
- **To**: [Role/Name]
- **What transfers**: [Deliverable/responsibility]
- **Ownership transfer**: [Clear/Unclear]
- **Risk**: [Low/Medium/High]

### [Handoff 2: Phase Y → Phase Z]
- **From**: [Role/Name]
- **To**: [Role/Name]
- **What transfers**: [Deliverable/responsibility]
- **Ownership transfer**: [Clear/Unclear]
- **Risk**: [Low/Medium/High]

## Ownership Gaps Identified

### Gap 1: [Description]
- **Phase**: [Where the gap exists]
- **Issue**: [What's missing]
- **Impact**: [Risk if unaddressed]
- **Recommendation**: [Who should own this]

### Gap 2: [Description]
- **Phase**: [Where the gap exists]
- **Issue**: [What's missing]
- **Impact**: [Risk if unaddressed]
- **Recommendation**: [Who should own this]

## Red Flags

- [ ] "The team" is listed as owner (must be a person)
- [ ] Ownership stops at delivery without outcome accountability
- [ ] Handoff without clear transfer of accountability
- [ ] No one owns customer success metrics
- [ ] Phase 5/6 owners not identified

## Assessment

**End-to-End Ownership Score**: [Strong/Adequate/Weak]

**Rationale**: [Why this assessment]

## Recommendations

1. [Action to strengthen ownership]
2. [Action to close gaps]
3. [Action to improve handoffs]
```

## Instructions

1. Ask what initiative or deliverable to map ownership for
2. Identify the current V2V phase
3. Map owners for each phase's relevant deliverables
4. Identify the single end-to-end accountable owner
5. Document all handoff points
6. Flag any ownership gaps or red flags
7. Provide assessment and recommendations

## Validation Questions

When mapping ownership, verify:
- Is there ONE person (not a team) accountable for overall success?
- Does accountability extend from strategy through outcomes?
- Are all handoffs accompanied by clear ownership transfer?
- Is someone accountable for Phase 5 & 6 (outcomes and learning)?

## Red Flag Triggers

Immediately flag if:
- "Team" or "Committee" is listed as owner
- Ownership chain stops at Phase 4 (delivery)
- Any phase has no identified owner
- Handoffs lack explicit accountability transfer

## Related Skills

- `/commitment-check` - Uses ownership map as prerequisite
- `/phase-check` - Identifies current phase for context
- `/decision-record` - Requires single accountable owner

## Operating Principle

> "End-to-end ownership means a name, not a team. If everyone is responsible, no one is responsible."
