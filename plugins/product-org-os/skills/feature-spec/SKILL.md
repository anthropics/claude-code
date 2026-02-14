---
name: feature-spec
description: "Create a detailed feature specification. Use when user says 'feature spec', 'specify this feature', 'detailed requirements', or needs implementation-ready specs."
argument-hint: [feature name] or [update path/to/spec.md]
user-invocable: true
metadata:
  author: Product Org OS
  version: 3.0.0
  category: requirements
compatibility: Requires Product Org OS v3+ context layer and rules
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/spec.md`) | UPDATE | 100% |
| Spec ID mentioned (`FS-2026-001`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list specs" | FIND | 100% |
| "the spec", "the feature spec" | UPDATE | 85% |
| Just feature name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new feature spec using template below.

**UPDATE**:
1. Read existing spec (search if path not provided)
2. Preserve unchanged sections exactly
3. Update only sections mentioned by user
4. Show diff summary: "Updated: [sections]. Unchanged: [sections]."
5. Update `last_modified` metadata

**FIND**:
1. Search paths below for feature specs
2. Present results: title, path, date, summary
3. Ask: "Update one of these, or create new?"

### Search Locations for Feature Specs

- `specs/`
- `features/`
- `requirements/`
- `docs/specs/`

---

Create a **Feature Specification** for the specified feature.

## V2V Phase

**Phase 3: Strategic Commitments** - Feature specs detail requirements for implementation.

**Prerequisites**: PRD approved or roadmap item defined
**Outputs used by**: Engineering implementation, design work, QA testing

## Output Structure

```markdown
# Feature Spec: [Feature Name]

**Spec ID**: FS-[YYYY]-[NNN]
**Owner**: [PM Name]
**Status**: Draft / In Review / Approved / In Development
**Target Release**: [Release/Version]

## Feature Overview

**Name**: [Feature name]
**One-liner**: [What it does in one sentence]

## Problem Statement

**Customer Problem**: [What problem this solves]
**Evidence**: [How we know this is a real problem]
**Impact of Not Solving**: [What happens if we don't build this]

## Target Users

**Primary User**: [User type]
- Role: [Their role]
- Goal: [What they're trying to accomplish]
- Current workaround: [How they do it today]

**Secondary User**: [User type]
- Role: [Their role]
- Goal: [What they're trying to accomplish]

## Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| [Metric 1] | [Current] | [Target] | [How measured] |
| [Metric 2] | [Current] | [Target] | [How measured] |

## Functional Requirements

### Requirement 1: [Name]
**Description**: [What it does]
**Priority**: Must Have / Should Have / Nice to Have
**Acceptance Criteria**:
- Given [context], when [action], then [result]
- Given [context], when [action], then [result]

### Requirement 2: [Name]
[Same structure]

## User Stories

### Story 1
**As a** [user type]
**I want to** [action]
**So that** [benefit]

**Acceptance Criteria**:
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

### Story 2
[Same structure]

## Non-Functional Requirements

| Requirement | Specification |
|-------------|---------------|
| Performance | [Spec] |
| Security | [Spec] |
| Accessibility | [Spec] |
| Scalability | [Spec] |

## Design Requirements

**User Flow**: [Description or link]
**Key Interactions**: [Critical interactions]
**Edge Cases**: [Edge cases to handle]

## Technical Considerations

**Architecture Impact**: [Any architecture changes]
**Dependencies**: [Technical dependencies]
**Constraints**: [Technical constraints]

## Out of Scope

- [Item 1]
- [Item 2]

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| [Risk] | H/M/L | H/M/L | [Plan] |

## Timeline

| Milestone | Target Date |
|-----------|-------------|
| Spec approval | [Date] |
| Design complete | [Date] |
| Development complete | [Date] |
| QA complete | [Date] |
| Release | [Date] |
```

## Instructions

1. Ask clarifying questions about scope if needed
2. Reference any research or design documents via @file syntax
3. Include testable acceptance criteria
4. Be explicit about what's out of scope
5. Save in requirements/ or specs/ folder
