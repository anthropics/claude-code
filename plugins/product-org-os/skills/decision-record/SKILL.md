---
name: decision-record
description: Create or update a structured decision record
argument-hint: [decision topic] or [update DR-2026-001]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/decision.md`) | UPDATE | 100% |
| Decision ID mentioned (`DR-2026-001`) | UPDATE | 100% |
| "create", "new", "record" in input | CREATE | 100% |
| "find", "search", "list decisions" | FIND | 100% |
| "the decision", "that decision" | UPDATE | 85% |
| Just decision topic | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new decision record using template below.

**UPDATE**:
1. Read existing decision (search if path not provided)
2. Preserve unchanged sections exactly
3. Update status, add new context, modify rationale
4. Show diff summary: "Updated: [sections]. Unchanged: [sections]."
5. Consider: Should status change (e.g., Proposed → Accepted)?

**FIND**:
1. Search paths below AND context registry for decisions
2. Present results: ID, title, date, status, owner
3. Ask: "Update one of these, or create new?"

### Search Locations for Decision Records

- `decisions/`
- `context/decisions/`
- `docs/decisions/`
- `adr/` (architecture decision records)

---

Create a **Decision Record** to document a specific decision.

## V2V Phase

**Phase 2: Strategic Decisions** - Decision records document choices made during the commercial filter phase.

**Prerequisites**: Context understood, options identified
**Outputs used by**: Phase 3 (roadmap, GTM commitments), context registry

## Purpose
Decision records capture the context, options, and rationale for important decisions, enabling future teams to understand why decisions were made.

## Output Structure

```markdown
# Decision Record: [Decision Title]

**Decision ID**: DR-[YYYY]-[NNN]
**Date**: [Date decided]
**Status**: Proposed / Accepted / Superseded / Deprecated
**Accountable Owner**: [Single person/role who can say yes/no]
**Product**: [Product name - optional, for multi-product organizations]

## Context

[Why this decision is needed now. What problem or opportunity prompted this decision? What constraints exist?]

## Decision Drivers

- [Driver 1]: [Description]
- [Driver 2]: [Description]
- [Driver 3]: [Description]

## Options Considered

### Option A: [Name]
**Description**: [What this option entails]

| Pros | Cons |
|------|------|
| [Pro 1] | [Con 1] |
| [Pro 2] | [Con 2] |

**Effort**: Low / Medium / High
**Risk**: Low / Medium / High

### Option B: [Name]
**Description**: [What this option entails]

| Pros | Cons |
|------|------|
| [Pro 1] | [Con 1] |
| [Pro 2] | [Con 2] |

**Effort**: Low / Medium / High
**Risk**: Low / Medium / High

### Option C: [Name]
**Description**: [What this option entails]

| Pros | Cons |
|------|------|
| [Pro 1] | [Con 1] |
| [Pro 2] | [Con 2] |

**Effort**: Low / Medium / High
**Risk**: Low / Medium / High

## Decision Made

**Selected Option**: [Option name]

**Rationale**: [Why this option was chosen over others. What were the key factors that tipped the decision?]

## Customer Value Link (Principle #3)

**Customer Problem**: [What customer problem does this decision address?]
**Customer Benefit**: [How will customers benefit from this decision?]
**Evidence**: [What customer evidence supports this direction?]

*If this decision has no customer value link, document why (internal efficiency, technical debt, etc.)*

## Stakeholders Consulted (Principle #6)

| Stakeholder | Role | Input Provided | Input Incorporated? |
|-------------|------|----------------|---------------------|
| [Name] | [Role] | [Summary of input] | Yes/Partial/No |
| [Name] | [Role] | [Summary of input] | Yes/Partial/No |

**Who should have been consulted but wasn't?** [Names or "None"]
**Why?** [Reason if applicable]

## Key Assumptions

| Assumption | Confidence | Validation Method | If Wrong |
|------------|------------|-------------------|----------|
| [Assumption 1] | High/Med/Low | [How we'll know] | [Impact] |
| [Assumption 2] | High/Med/Low | [How we'll know] | [Impact] |

## Success Criteria

| Metric | Target | Timeframe | How Measured |
|--------|--------|-----------|--------------|
| [Metric 1] | [Target] | [When] | [Method] |
| [Metric 2] | [Target] | [When] | [Method] |

## Re-decision Trigger

This decision should be revisited if:
- [Condition 1]
- [Condition 2]
- [Condition 3]

## Implementation Notes

[Any specific guidance for implementing this decision]

## Contributors

| Name | Role | Contribution |
|------|------|--------------|
| [Name] | [Role] | Accountable |
| [Name] | [Role] | Input provided |
| [Name] | [Role] | Consulted |

## Related Decisions

- [Link to related decision record]
```

## Instructions

1. Ask clarifying questions about the decision if context is unclear
2. **Check prior context**: Run `/context-recall [topic]` to find related past decisions
3. Reference any relevant documents provided via @file syntax
4. Ensure there's a single accountable owner
5. Include measurable success criteria
6. Define clear re-decision triggers
7. Save in decisions/ folder
8. Offer to create presentation version using /present

## Context Integration

After generating the decision record:

1. **Offer to save**: Ask "Should I save this to the context registry? (`/context-save`)"
2. If yes, extract and save:
   - Decision ID, title, date, owner, status to `context/decisions/index.md`
   - Tags (auto-generate 3-5 keywords from content)
   - Assumptions to `context/assumptions/registry.md`
   - Full record to `context/decisions/[YYYY]/[DR-ID].md`
3. Link to related decisions if mentioned
