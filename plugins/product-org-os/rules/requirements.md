---
globs:
  - "**/requirements/**"
  - "**/prds/**"
  - "**/specs/**"
---

# Requirements Document Rules

When working with requirements in `requirements/`, `prds/`, or `specs/` folders:

## Required Elements

Every requirements document MUST have:

1. **Customer-Centric Problem**
   - Problem stated from customer perspective
   - Evidence of the problem
   - Impact of not solving

2. **Success Criteria**
   - Measurable outcomes
   - Acceptance criteria for each requirement
   - How success will be measured

3. **Clear Ownership**
   - PM owner identified
   - RACI for key decisions
   - Escalation path defined

4. **Scope Boundaries**
   - What's in scope (explicit)
   - What's out of scope (explicit)
   - Future considerations

## Requirements Quality Checks

- [ ] Problem is customer-focused
- [ ] User stories follow proper format
- [ ] Acceptance criteria are testable
- [ ] Dependencies identified
- [ ] Risks acknowledged
- [ ] Technical feasibility confirmed

## User Story Format

```
As a [user type]
I want to [action]
So that [benefit]

Acceptance Criteria:
- Given [context], when [action], then [result]
```

## V2V Operating Principle

> "Start with the customer problem, not the solution. Every feature needs success criteria."

Requirements should be problem-driven. A feature without a clear customer problem is a solution looking for a problem.
