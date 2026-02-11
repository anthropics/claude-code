---
name: prd
description: Create or update a Product Requirements Document
argument-hint: [product/feature name] or [update path/to/prd.md]
user-invocable: true
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/prd.md`) | UPDATE | 100% |
| PRD ID mentioned (`PRD-2026-001`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list PRDs" | FIND | 100% |
| "the PRD", "our requirements" | UPDATE | 85% |
| Just topic/feature name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new PRD using template below.

**UPDATE**:
1. Read existing PRD (search if path not provided)
2. Preserve unchanged sections exactly
3. Update only sections mentioned by user
4. Show diff summary: "Updated: [sections]. Unchanged: [sections]."
5. Update `last_modified` metadata

**FIND**:
1. Search paths below for PRDs
2. Present results: title, path, date, summary
3. Ask: "Update one of these, or create new?"

### Search Locations for PRDs

- `requirements/`
- `prds/`
- `specs/`
- `docs/requirements/`

---

Create a **complete Product Requirements Document (PRD)** for the specified product or feature.

## V2V Phase

**Phase 3: Strategic Commitments** - PRDs commit engineering resources to specific requirements.

**Prerequisites**: Roadmap item approved, design direction established
**Outputs used by**: Engineering execution, QA planning, launch preparation

## Output Structure

Generate a comprehensive PRD with the following sections:

### 1. Executive Summary
- One paragraph overview of the product/feature
- Key value proposition
- Target launch timeframe

### 2. Problem Statement & Opportunity
- Customer problem being solved
- Market opportunity
- Business justification
- Link to strategic goals

### 3. Target Users & Personas
- Primary user persona(s)
- Secondary user persona(s)
- User needs and pain points
- Jobs to be done

### 4. Goals & Success Metrics
| Metric | Target | Timeframe |
|--------|--------|-----------|
| [Leading indicator] | [Target] | T+2 weeks |
| [Mid indicator] | [Target] | T+6 weeks |
| [Lagging indicator] | [Target] | T+12 weeks |

### 5. Functional Requirements
For each requirement:
- ID and name
- Description
- Priority (Must have / Should have / Nice to have)
- Acceptance criteria

### 6. Non-Functional Requirements
- Performance requirements
- Security requirements
- Scalability requirements
- Accessibility requirements
- Compliance requirements

### 7. User Stories
For each story:
```
As a [user type]
I want to [action]
So that [benefit]

Acceptance Criteria:
- Given [context], when [action], then [result]
```

### 8. Design Requirements
- UX principles to follow
- Key user flows
- Wireframe/mockup references
- Design system components to use

### 9. Technical Considerations
- Architecture implications
- Integration requirements
- Data requirements
- Technical constraints
- Build vs buy considerations

### 10. Dependencies
- Internal dependencies
- External dependencies
- Third-party integrations

### 11. Timeline & Milestones
| Milestone | Date | Deliverable |
|-----------|------|-------------|
| [Phase 1] | [Date] | [What's delivered] |

### 12. Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk] | High/Med/Low | High/Med/Low | [Plan] |

### 13. Appendices
- Research references
- Competitive analysis references
- Technical specs references

## Instructions

1. Ask clarifying questions if the product/feature scope is unclear
2. Reference any documents the user provides via @file syntax
3. Create a complete, actionable PRD
4. Save as markdown file in appropriate location
5. Offer to create presentation version using /present
