---
name: user-story
description: Create or update a user story with acceptance criteria
argument-hint: [story description] or [update path/to/story.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/story.md`) | UPDATE | 100% |
| Story ID mentioned (`US-2026-001`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list stories" | FIND | 100% |
| "the story", "the user story" | UPDATE | 85% |
| Just story description | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new user story using template below.

**UPDATE**:
1. Read existing story (search if path not provided)
2. Preserve unchanged sections exactly
3. Update only sections mentioned by user
4. Show diff summary: "Updated: [sections]. Unchanged: [sections]."
5. Update status and metadata

**FIND**:
1. Search paths below for user stories
2. Present results: title, path, status, summary
3. Ask: "Update one of these, or create new?"

### Search Locations for User Stories

- `stories/`
- `backlog/`
- `requirements/stories/`
- `epics/`

---

Write a **User Story** with acceptance criteria.

## V2V Phase

**Phase 3: Strategic Commitments** - User stories are the atomic unit of requirements commitment.

**Prerequisites**: Feature spec or PRD with scope defined
**Outputs used by**: Sprint planning, engineering implementation, QA verification

## Output Structure

```markdown
# User Story: [Brief Title]

**Story ID**: US-[YYYY]-[NNN]
**Epic**: [Parent epic]
**Owner**: [PM Name]
**Priority**: Must Have / Should Have / Nice to Have
**Status**: Draft / Ready / In Progress / Done

## Story

**As a** [user type/persona]
**I want to** [action/capability]
**So that** [benefit/value]

## Context

**Why This Matters**: [Business/user context]
**Current State**: [How it works today or doesn't exist]
**Desired State**: [How it should work]

## Acceptance Criteria

### Criterion 1: [Name]
**Given** [precondition/context]
**When** [action taken]
**Then** [expected result]

### Criterion 2: [Name]
**Given** [precondition/context]
**When** [action taken]
**Then** [expected result]

### Criterion 3: [Name]
**Given** [precondition/context]
**When** [action taken]
**Then** [expected result]

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| [Edge case 1] | [Behavior] |
| [Edge case 2] | [Behavior] |
| [Edge case 3] | [Behavior] |

## Error Handling

| Error Condition | User Message | System Behavior |
|-----------------|--------------|-----------------|
| [Error 1] | [Message] | [Behavior] |
| [Error 2] | [Message] | [Behavior] |

## Dependencies

- [Dependency 1]
- [Dependency 2]

## Design Notes

**UI/UX Considerations**: [Design notes]
**Accessibility**: [A11y requirements]

## Technical Notes

**Implementation Hints**: [Technical guidance]
**API Changes**: [If applicable]

## Definition of Done

- [ ] Code complete and reviewed
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Acceptance criteria verified
- [ ] Design QA passed
- [ ] Documentation updated
- [ ] Ready for release
```

## Instructions

1. Ask clarifying questions about the user and goal if unclear
2. Reference any design or research documents via @file syntax
3. Use Given/When/Then format for acceptance criteria
4. Include edge cases and error handling
5. Save in stories/ or backlog/ folder
