---
name: prd-outline
description: Create or update a PRD outline
argument-hint: [product/feature name] or [update path/to/outline.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/outline.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list outlines" | FIND | 100% |
| "the outline", "the PRD outline" | UPDATE | 85% |
| Just product/feature name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new PRD outline using template below.

**UPDATE**:
1. Read existing outline (search if path not provided)
2. Check off completed items
3. Add new research questions or stakeholder inputs
4. Show progress: "Completed: [N] sections. Remaining: [M]."

**FIND**:
1. Search paths below for PRD outlines
2. Present results: title, path, completion status
3. Ask: "Update one of these, or create new?"

### Search Locations for PRD Outlines

- `requirements/`
- `prds/`
- `outlines/`
- `docs/requirements/`

---

Create a **PRD Outline** as a starting point for a full PRD.

## V2V Phase

**Phase 3: Strategic Commitments** - PRD outlines start the requirements commitment process.

**Prerequisites**: Roadmap item identified, initial scope understood
**Outputs used by**: Full PRD development, stakeholder alignment

## Output Structure

```markdown
# PRD Outline: [Product/Feature Name]

**Author**: [Name]
**Date**: [Date]
**Status**: Outline

---

## 1. Executive Summary
[ ] Problem we're solving
[ ] Proposed solution
[ ] Key outcomes expected
[ ] Timeline and investment

## 2. Problem Statement
[ ] Customer problem description
[ ] Evidence and data
[ ] Business impact
[ ] Why now?

## 3. Goals & Success Metrics
[ ] Primary goal
[ ] Secondary goals
[ ] Success metrics (leading indicators)
[ ] Success metrics (lagging indicators)

## 4. Target Users
[ ] Primary persona
[ ] Secondary persona(s)
[ ] User needs
[ ] Jobs to be done

## 5. Solution Overview
[ ] High-level approach
[ ] Key capabilities
[ ] What's NOT included

## 6. Requirements
[ ] Functional requirements list
[ ] Non-functional requirements
[ ] Priority ranking

## 7. User Stories
[ ] Epic breakdown
[ ] Story list
[ ] Acceptance criteria (top stories)

## 8. Design
[ ] User flows
[ ] Key screens/interactions
[ ] Design principles

## 9. Technical Considerations
[ ] Architecture impact
[ ] Dependencies
[ ] Constraints

## 10. Launch & GTM
[ ] Release strategy
[ ] GTM coordination needed
[ ] Support/enablement needs

## 11. Risks & Mitigations
[ ] Key risks
[ ] Mitigation plans

## 12. Timeline
[ ] Key milestones
[ ] Dependencies

---

## Research Needed

| Question | Owner | Due Date |
|----------|-------|----------|
| [Question 1] | [Owner] | [Date] |
| [Question 2] | [Owner] | [Date] |

## Stakeholder Input Needed

| Stakeholder | Input Needed | By When |
|-------------|--------------|---------|
| [Stakeholder] | [Input] | [Date] |

## Next Steps

1. [ ] [Action item 1]
2. [ ] [Action item 2]
3. [ ] [Action item 3]
```

## Instructions

1. Use this as a starting checklist for a full PRD
2. Check boxes as sections are completed
3. Track research and stakeholder inputs needed
4. Expand into full PRD using /prd skill
5. Save in requirements/ folder
