---
name: launch-plan
description: Create or update a product launch plan
argument-hint: [product or feature name] or [update path/to/launch-plan.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/launch-plan.md`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list launch plans" | FIND | 100% |
| "the launch plan", "our launch" | UPDATE | 85% |
| Just product/feature name | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new launch plan using template below.

**UPDATE**:
1. Read existing launch plan (search if path not provided)
2. Preserve unchanged sections exactly
3. Update timeline, status, activities, owners
4. Show diff summary: "Updated: [sections]. Unchanged: [sections]."
5. Mark activity statuses (Not Started → In Progress → Complete)

**FIND**:
1. Search paths below for launch plans
2. Present results: product, launch date, status, path
3. Ask: "Update one of these, or create new?"

### Search Locations for Launch Plans

- `launch/`
- `gtm/`
- `releases/`
- `docs/launch/`

---

Create a **complete Product Launch Plan** for the specified product or feature.

## V2V Phase

**Phase 3: Strategic Commitments** - Launch plans commit cross-functional resources to execution.

**Prerequisites**: GTM strategy approved, product roadmap committed
**Outputs used by**: Phase 4 (coordinated execution across all functions)

## Output Structure

Generate a comprehensive launch plan with the following sections:

### 1. Executive Summary
- Product/feature being launched
- Launch date
- Key objectives
- Critical success factors
- Major risks

### 2. Launch Objectives & Success Criteria

| Objective | Metric | Target | Timeframe |
|-----------|--------|--------|-----------|
| Awareness | [Metric] | [Target] | Launch +30 days |
| Adoption | [Metric] | [Target] | Launch +60 days |
| Revenue | [Metric] | [Target] | Launch +90 days |

### 3. Target Audience & Messaging

#### Primary Audience
- Who they are
- Why they care
- Key message

#### Secondary Audience
- Who they are
- Why they care
- Key message

### 4. Launch Timeline

#### T-8 Weeks (Preparation)
| Activity | Owner | Due Date | Status |
|----------|-------|----------|--------|
| [Activity] | [Owner] | [Date] | Not Started |

#### T-4 Weeks (Pre-Launch)
| Activity | Owner | Due Date | Status |
|----------|-------|----------|--------|
| [Activity] | [Owner] | [Date] | Not Started |

#### T-1 Week (Final Prep)
| Activity | Owner | Due Date | Status |
|----------|-------|----------|--------|
| [Activity] | [Owner] | [Date] | Not Started |

#### Launch Day
| Activity | Owner | Time | Status |
|----------|-------|------|--------|
| [Activity] | [Owner] | [Time] | Not Started |

#### Post-Launch (Week 1-4)
| Activity | Owner | Timing | Status |
|----------|-------|--------|--------|
| [Activity] | [Owner] | [Timing] | Not Started |

### 5. Cross-Functional Responsibilities (RACI)

| Activity | Product | Engineering | Marketing | Sales | Support | CS |
|----------|---------|-------------|-----------|-------|---------|-----|
| [Activity] | R/A/C/I | R/A/C/I | R/A/C/I | R/A/C/I | R/A/C/I | R/A/C/I |

### 6. Marketing Activities & Campaigns

| Campaign | Channel | Audience | Timing | Owner | Budget |
|----------|---------|----------|--------|-------|--------|
| [Campaign] | [Channel] | [Audience] | [When] | [Owner] | $X |

### 7. Sales Enablement Activities

| Deliverable | Purpose | Owner | Due Date |
|-------------|---------|-------|----------|
| Sales deck | Prospect presentations | [Owner] | [Date] |
| Demo script | Consistent demos | [Owner] | [Date] |
| Battle cards | Competitive selling | [Owner] | [Date] |
| FAQ | Objection handling | [Owner] | [Date] |

### 8. Customer Success Preparation

- Onboarding materials ready
- Training completed
- Success metrics defined
- Health scoring updated
- Playbooks created

### 9. Support Readiness

- Knowledge base updated
- Support team trained
- Escalation paths defined
- FAQ published
- Tier 1/2/3 coverage confirmed

### 10. Technical/Operations Readiness

- Infrastructure scaled
- Monitoring in place
- Rollback plan ready
- Performance tested
- Security reviewed

### 11. Risk Mitigation Plan

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| [Risk] | High/Med/Low | High/Med/Low | [Plan] | [Owner] |

### 12. Budget

| Category | Amount | Notes |
|----------|--------|-------|
| Marketing | $X | [Notes] |
| Events | $X | [Notes] |
| Enablement | $X | [Notes] |
| **Total** | $X | |

### 13. Post-Launch Activities

| Activity | Timing | Owner | Purpose |
|----------|--------|-------|---------|
| Launch review | L+1 week | [Owner] | Assess early results |
| Metrics review | L+30 days | [Owner] | Track success criteria |
| Retrospective | L+60 days | [Owner] | Capture learnings |

## Instructions

1. Ask about launch date if not specified
2. Reference any GTM or product documents provided via @file syntax
3. Ensure all functions have clear responsibilities
4. Include contingency plans
5. Save as markdown file
6. Offer to create presentation version using /present
