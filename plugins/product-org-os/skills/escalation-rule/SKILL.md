---
name: escalation-rule
description: Create or update escalation rules for a decision area
argument-hint: [decision area] or [update path/to/rule.md]
---

## Document Intelligence

This skill supports three modes: **Create**, **Update**, and **Find**.

### Mode Detection

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided | UPDATE | 100% |
| Rule ID mentioned (e.g., ESC-2026-001) | UPDATE | 100% |
| "create", "new", "define" in input | CREATE | 100% |
| "find", "search", "list" | FIND | 100% |
| "the escalation rule", "our rules" | UPDATE | 85% |
| Just decision area | CREATE | 60% |

**Threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE**: Generate complete new escalation rule using template below.

**UPDATE**:
1. Check document registry first, then search user's structure
2. Preserve rule ID and version
3. Update triggers, matrix, or resolution expectations
4. Show diff summary

**FIND**: Check registry, then search user's folders for escalation rules.

---

Define **Escalation Rules** for a specific decision area.

## V2V Phase

**Phase 2: Strategic Decisions** - Escalation rules ensure decision quality when standard authority is insufficient.

**Prerequisites**: Decision charters or patterns established
**Outputs used by**: All phases (provides escalation governance)

## Purpose
Escalation rules ensure decisions move up appropriately when they exceed normal authority or encounter blockers.

## Output Structure

```markdown
# Escalation Rule: [Decision Area]

**Rule ID**: ESC-[YYYY]-[NNN]
**Version**: 1.0
**Effective Date**: [Date]
**Owner**: [Role]

## Scope

**Decision Area**: [What types of decisions this covers]
**Default Owner**: [Role who normally decides]
**Normal Authority**: [What they can decide without escalation]

## Escalation Triggers

### Trigger 1: [Name]
**Condition**: [When this trigger activates]
**Examples**:
- [Example situation]
- [Example situation]

**Escalate To**: [Role]
**Timeline**: [How quickly]

### Trigger 2: [Name]
**Condition**: [When this trigger activates]
**Examples**:
- [Example situation]
- [Example situation]

**Escalate To**: [Role]
**Timeline**: [How quickly]

### Trigger 3: [Name]
**Condition**: [When this trigger activates]
**Examples**:
- [Example situation]
- [Example situation]

**Escalate To**: [Role]
**Timeline**: [How quickly]

## Escalation Matrix

| Trigger Type | Level 1 | Level 2 | Level 3 |
|--------------|---------|---------|---------|
| Budget exceeded | [Role] | [Role] | [Role] |
| Timeline risk | [Role] | [Role] | [Role] |
| Stakeholder conflict | [Role] | [Role] | [Role] |
| Technical blocker | [Role] | [Role] | [Role] |
| Resource constraint | [Role] | [Role] | [Role] |

## Escalation Process

### Step 1: Recognize the Trigger
- Identify which trigger condition applies
- Document the situation clearly

### Step 2: Prepare the Escalation
Before escalating, prepare:
- [ ] Summary of the situation (1 paragraph)
- [ ] What has been tried
- [ ] Options with pros/cons
- [ ] Recommended action
- [ ] Timeline for decision needed

### Step 3: Escalate
- Contact the appropriate escalation owner
- Provide prepared information
- Agree on decision timeline

### Step 4: Follow Up
- Document the escalated decision
- Communicate to affected parties
- Update relevant plans

## Information Required for Escalation

**Always include:**
1. What triggered the escalation
2. Impact if not resolved
3. Options considered
4. Recommended path forward
5. Decision needed by when

**Format**: [Template or document to use]

## Resolution Expectations

| Priority | Response Time | Resolution Time |
|----------|---------------|-----------------|
| Critical | < 4 hours | < 24 hours |
| High | < 24 hours | < 72 hours |
| Medium | < 48 hours | < 1 week |
| Low | < 1 week | < 2 weeks |

## Anti-Patterns (Don't Do This)

- **Escalating without preparation**: Always come with options
- **Skipping levels**: Follow the escalation path
- **Waiting too long**: Escalate early when triggers hit
- **Escalating everything**: Use judgment; not everything needs escalation

## Related Rules

- [Link to related escalation rules]
- [Link to related decision charters]
```

## Instructions

1. Ask about the decision area if not specified
2. Reference any governance documents provided via @file syntax
3. Be specific about trigger conditions
4. Include clear escalation paths
5. Define expected resolution times
6. Save in rules/ or governance/ folder
