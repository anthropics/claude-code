---
name: campaign-brief
description: Create or update a marketing campaign brief
argument-hint: [campaign name or objective] or [update path/to/campaign.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/campaign.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list campaigns" | FIND | 100% |
| "the campaign", "our campaign" | UPDATE | 85% |
| Just campaign name/objective | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new campaign brief using template below.

**UPDATE**:
1. Read existing campaign brief (search if path not provided)
2. Preserve unchanged sections exactly
3. Update timeline, budget, metrics, or activities
4. Show diff summary: "Updated: [sections]. Unchanged: [sections]."

**FIND**:
1. Search paths below for campaign briefs
2. Present results: campaign name, status, dates, path
3. Ask: "Update one of these, or create new?"

### Search Locations for Campaign Briefs

- `campaigns/`
- `marketing/`
- `gtm/campaigns/`
- `marketing/campaigns/`

---

Create a **Marketing Campaign Brief** for the specified campaign.

## V2V Phase
**Phase 4: Coordinated Execution** - This skill supports marketing execution.

## Output Structure

### 1. Campaign Overview
- Campaign name
- Campaign type (awareness, demand gen, product launch, etc.)
- Duration
- Budget

### 2. Campaign Objectives
| Objective | Metric | Target |
|-----------|--------|--------|
| [Objective 1] | [Metric] | [Target] |
| [Objective 2] | [Metric] | [Target] |

### 3. Target Audience
- Primary audience
- Secondary audience
- Audience size estimate
- Audience characteristics
- Where they spend time

### 4. Key Messages
- Primary message (one sentence)
- Supporting messages (3-5 points)
- Proof points
- Tone and voice

### 5. Channels & Tactics

| Channel | Tactic | Audience | Budget | Owner |
|---------|--------|----------|--------|-------|
| [Channel 1] | [Tactic] | [Audience] | $X | [Owner] |
| [Channel 2] | [Tactic] | [Audience] | $X | [Owner] |

### 6. Timeline

| Phase | Dates | Activities |
|-------|-------|------------|
| Planning | [Dates] | [Activities] |
| Pre-launch | [Dates] | [Activities] |
| Launch | [Dates] | [Activities] |
| Sustain | [Dates] | [Activities] |
| Wrap-up | [Dates] | [Activities] |

### 7. Budget Breakdown

| Category | Amount | % of Total |
|----------|--------|------------|
| Media | $X | X% |
| Creative | $X | X% |
| Events | $X | X% |
| Tools | $X | X% |
| **Total** | $X | 100% |

### 8. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Reach | [Target] | [How measured] |
| Engagement | [Target] | [How measured] |
| Leads | [Target] | [How measured] |
| Pipeline | [Target] | [How measured] |

### 9. Creative Requirements
- Assets needed
- Formats and sizes
- Brand guidelines
- Approval process
- Due dates

### 10. Dependencies & Risks

| Dependency/Risk | Impact | Mitigation |
|-----------------|--------|------------|
| [Item] | High/Med/Low | [Plan] |

## Instructions

1. Ask about campaign objectives if not specified
2. Reference any brand or marketing strategy documents provided via @file syntax
3. Ensure budget and timeline are realistic
4. Include clear success metrics
5. Save as markdown file
6. Offer to create presentation version using /present
