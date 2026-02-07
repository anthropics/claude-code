---
name: roadmap-item
description: Create or update a specific roadmap item
argument-hint: [item name] or [update path/to/item.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/item.md`) | UPDATE | 100% |
| Item ID mentioned (`RI-2026-001`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list items" | FIND | 100% |
| "the item", "the initiative" | UPDATE | 85% |
| Just item name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new roadmap item using template below.

**UPDATE**:
1. Read existing item (search if path not provided)
2. Preserve unchanged sections exactly
3. Update status, priority, timeline, or scope
4. Show diff summary: "Updated: [sections]. Unchanged: [sections]."

**FIND**:
1. Search paths below for roadmap items
2. Present results: item name, ID, status, theme
3. Ask: "Update one of these, or create new?"

### Search Locations for Roadmap Items

- `roadmap/items/`
- `roadmap/`
- `backlog/`
- `epics/`

---

Define a **Roadmap Item** (initiative, epic, or feature).

## V2V Phase

**Phase 3: Strategic Commitments** - Roadmap items are the specific commitments within themes.

**Prerequisites**: Roadmap theme defined, capacity understood
**Outputs used by**: PRDs, feature specs, sprint planning

## Output Structure

```markdown
# Roadmap Item: [Item Name]

**Item ID**: RI-[YYYY]-[NNN]
**Type**: Epic / Feature / Initiative
**Theme**: [Parent theme]
**Owner**: [Name]
**Status**: Proposed / Planned / In Progress / Completed

## Overview

**Description**: [What this item delivers]

**Customer Problem**: [What customer problem it solves]

**Value Proposition**: [Why customers care]

## Priority

**Priority**: P0 (Must have) / P1 (Should have) / P2 (Nice to have)

**Prioritization Rationale**:
- Strategic alignment: [High/Med/Low]
- Customer demand: [High/Med/Low]
- Revenue impact: [High/Med/Low]
- Effort: [S/M/L/XL]

## Target Timeline

**Target Quarter**: [Quarter]
**Target Release**: [Release/Version]
**Confidence**: High / Medium / Low

## Success Criteria

| Metric | Target | Timeframe |
|--------|--------|-----------|
| [Metric 1] | [Target] | [When] |
| [Metric 2] | [Target] | [When] |

## Scope

**In Scope**:
- [Item 1]
- [Item 2]
- [Item 3]

**Out of Scope**:
- [Item 1]
- [Item 2]

**Future Considerations**:
- [Item 1]

## Dependencies

| Dependency | Type | Owner | Status | Blocking? |
|------------|------|-------|--------|-----------|
| [Dependency] | Technical/Resource/External | [Owner] | [Status] | Yes/No |

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| [Risk] | High/Med/Low | High/Med/Low | [Plan] |

## Effort Estimate

**T-Shirt Size**: S / M / L / XL
**Engineering**: [Estimate]
**Design**: [Estimate]
**Other**: [Estimate]

## Related Items

- [Link to related roadmap items]
- [Link to PRD if exists]
```

## Instructions

1. Ask about the parent theme if not clear
2. Reference any related documents via @file syntax
3. Include clear success criteria
4. Be explicit about scope boundaries
5. Save in roadmap/ folder
