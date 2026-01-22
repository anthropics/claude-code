---
name: onboarding-playbook
description: Create or update a customer onboarding playbook
argument-hint: [product or customer segment] or [update path/to/playbook.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "improve" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| "create", "new", "build" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the playbook", "onboarding playbook" | UPDATE | 85% |
| Just product/segment | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new playbook using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve journey map structure
3. Update milestones, blockers, or success criteria
4. Show diff summary

**FIND**: Check registry, then search user's folders for playbooks.

---

Create a **Customer Onboarding Playbook** for the specified product or customer segment.

## V2V Phase
**Phase 5: Business & Customer Outcomes** - This skill ensures customers realize value.

## Output Structure

### 1. Onboarding Overview
- Target customer segment
- Onboarding duration
- Key milestones
- Success definition

### 2. Onboarding Journey Map

| Stage | Duration | Customer Goal | Our Activities | Success Criteria |
|-------|----------|---------------|----------------|------------------|
| Kickoff | Day 1-3 | [Goal] | [Activities] | [Criteria] |
| Setup | Week 1 | [Goal] | [Activities] | [Criteria] |
| Training | Week 2 | [Goal] | [Activities] | [Criteria] |
| Adoption | Week 3-4 | [Goal] | [Activities] | [Criteria] |
| Value | Week 4+ | [Goal] | [Activities] | [Criteria] |

### 3. Key Milestones

| Milestone | Target Timing | Definition of Done | Owner |
|-----------|---------------|-------------------|-------|
| Account activated | Day 1 | [Definition] | [Owner] |
| First use case completed | Week 1 | [Definition] | [Owner] |
| Team trained | Week 2 | [Definition] | [Owner] |
| Value milestone hit | Week 4 | [Definition] | [Owner] |

### 4. Success Criteria
| Metric | Target | Timeframe |
|--------|--------|-----------|
| Time to first value | X days | Day 1-7 |
| Feature adoption | X% | Week 1-4 |
| User activation | X% | Week 2-4 |
| Satisfaction score | X | Week 4 |

### 5. Common Blockers & Solutions

| Blocker | Symptoms | Solution | Owner |
|---------|----------|----------|-------|
| Technical integration issues | [Symptoms] | [Solution] | [Owner] |
| Low user adoption | [Symptoms] | [Solution] | [Owner] |
| Unclear success criteria | [Symptoms] | [Solution] | [Owner] |
| Champion turnover | [Symptoms] | [Solution] | [Owner] |

### 6. Escalation Paths

| Issue Type | First Contact | Escalation 1 | Escalation 2 |
|------------|---------------|--------------|--------------|
| Technical | [Contact] | [Contact] | [Contact] |
| Business | [Contact] | [Contact] | [Contact] |
| Relationship | [Contact] | [Contact] | [Contact] |

### 7. Time-to-Value Targets

| Segment | First Value | Full Value | At-Risk Threshold |
|---------|-------------|------------|-------------------|
| Enterprise | X days | X weeks | X weeks |
| Mid-market | X days | X weeks | X weeks |
| SMB | X days | X weeks | X weeks |

### 8. Health Indicators

**Green (On Track):**
- [Indicator 1]
- [Indicator 2]

**Yellow (At Risk):**
- [Indicator 1]
- [Indicator 2]

**Red (Intervention Needed):**
- [Indicator 1]
- [Indicator 2]

### 9. Handoff Procedures
- Handoff from sales to CS
- Handoff from implementation to ongoing support
- Documentation requirements
- Communication templates

### 10. Resources
- Onboarding materials
- Training content
- Templates
- FAQs

## Instructions

1. Ask about customer segment if not specified
2. Reference any product or CS documents provided via @file syntax
3. Include specific, measurable milestones
4. Address common blockers proactively
5. Save as markdown file
6. Offer to create presentation version using /present
