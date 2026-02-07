---
name: stakeholder-brief
description: Create or update a stakeholder communication brief
argument-hint: [topic or update] or [update path/to/brief.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/brief.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list briefs" | FIND | 100% |
| "the brief", "the stakeholder update" | UPDATE | 85% |
| Just topic | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new stakeholder brief using template below.

**UPDATE**:
1. Read existing brief (search if path not provided)
2. Preserve context and key messages
3. Update details, timeline, or FAQ
4. Add new stakeholder-specific messages if needed
5. Show diff summary: "Updated: [sections]. Unchanged: [sections]."

**FIND**:
1. Search paths below for stakeholder briefs
2. Present results: topic, date, audience, path
3. Ask: "Update one of these, or create new?"

### Search Locations for Stakeholder Briefs

- `communications/`
- `briefs/`
- `stakeholder/`
- `updates/`

---

Create a **Stakeholder Communication Brief** for an important update.

## V2V Phase

**Phase 4: Coordinated Execution** - Stakeholder briefs keep everyone informed during execution.

**Prerequisites**: Strategy or update defined, stakeholders identified
**Outputs used by**: Stakeholder alignment, decision support

## Output Structure

```markdown
# Stakeholder Brief: [Topic]

**Date**: [Date]
**Author**: [Name]
**Audience**: [Target stakeholders]
**Type**: Update / Decision Request / FYI

## TL;DR

[2-3 sentence summary of the key message]

## Context

**Background**: [What stakeholders need to know to understand this]
**Why Now**: [Why this communication is happening now]

## Key Message

[The main point you want stakeholders to take away]

## Details

### What's Happening
[Description of the situation, change, or update]

### Impact
**Who's Affected**: [Teams, customers, etc.]
**How**: [Nature of the impact]
**When**: [Timeline]

### What We're Doing About It
[Actions being taken]

## Stakeholder-Specific Messages

| Stakeholder | Their Concern | Key Message | Action Needed |
|-------------|---------------|-------------|---------------|
| [Stakeholder 1] | [Concern] | [Message] | [Action] |
| [Stakeholder 2] | [Concern] | [Message] | [Action] |

## FAQ

**Q: [Anticipated question 1]**
A: [Answer]

**Q: [Anticipated question 2]**
A: [Answer]

**Q: [Anticipated question 3]**
A: [Answer]

## What We Need From Stakeholders

| Stakeholder | Ask | By When |
|-------------|-----|---------|
| [Stakeholder] | [Specific ask] | [Date] |

## Timeline

| Date | Milestone |
|------|-----------|
| [Date] | [What happens] |

## Communication Plan

| Audience | Channel | Timing | Owner |
|----------|---------|--------|-------|
| [Audience] | [Channel] | [When] | [Owner] |

## Follow-up

**Questions**: Direct to [Name/contact]
**Next Update**: [Date/cadence]
```

## Instructions

1. Ask about target stakeholders if not specified
2. Reference any relevant documents via @file syntax
3. Tailor messages to stakeholder concerns
4. Anticipate questions and prepare answers
5. Save in communications/ folder
