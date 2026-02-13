---
globs:
  - "**/*"
---

# Agent Delegation Protocol

Structured patterns for agent-to-agent collaboration. Each pattern has triggers, ownership rules, and attribution.

---

## Pattern 1: CONSULTATION (Default)

**Trigger**: Need a domain perspective you don't own
**Ownership**: Stays with requesting agent
**Attribution**: "I consulted {emoji} {Name} who noted..."

Spawn sub-agent with specific questions → integrate response into your deliverable → attribute contribution.

**When to use**: Data point or perspective needed, not a full deliverable. Quick turnaround.

---

## Pattern 2: DELEGATION

**Trigger**: Task requires specialist to own a complete deliverable
**Ownership**: Transfers to specialist for sub-task
**Attribution**: Specialist output presented directly, credited to them

**Prompt format**:
```
[DELEGATION] to @{agent} for {deliverable}
Scope: {what to cover}
Deliverable: {what to produce}
Constraints: {boundaries, focus areas}
Context: {relevant background}
```

**When to use**: Deep specialist expertise needed, deliverable stands alone, want to parallelize work.

---

## Pattern 3: REVIEW

**Trigger**: Deliverable needs quality validation before publishing
**Ownership**: Original agent owns final output; reviewer provides feedback
**Attribution**: "Reviewed by {emoji} {Name}. Key feedback: [summary]"

**Prompt format**:
```
[REVIEW] by @{agent}
Deliverable: {path or content}
Review criteria: {criterion 1}, {criterion 2}, {criterion 3}
```

**Response format**: Prioritized findings (P0 Blocker / P1 Important / P2 Nice-to-have) + GO / GO WITH CHANGES / NEEDS REWORK.

| Deliverable | Reviewer |
|------------|----------|
| PRD, feature spec | @pm-dir, @ux-lead |
| Strategic bet | @vp-product, @bizops |
| GTM plan | @pmm-dir, @prod-ops |
| Roadmap | @vp-product, @pm-dir |
| Pricing | @bizops, @vp-product |

---

## Pattern 4: STRUCTURED DEBATE

**Trigger**: Genuine tradeoff where both sides have merit
**Ownership**: Senior agent/gateway owns synthesis
**Attribution**: Each agent speaks directly; synthesis by most senior

**Prompt format**:
```
[DEBATE] @{agent1} argues FOR {position A}
[DEBATE] @{agent2} argues FOR {position B}
Context: {the tradeoff}
Decision owner: @{senior agent}
```

Each agent presents: The Case, Evidence, Risks, Success Criteria, Conditions. Senior synthesizes.

**When NOT to use**: One option is clearly better, outcome predetermined, time pressure, information asymmetry.

---

## Pattern Selection

| Situation | Pattern |
|-----------|---------|
| Need a data point | **Consultation** |
| Specialist owns sub-deliverable | **Delegation** |
| Quality check before publishing | **Review** |
| Genuine tradeoff needs analysis | **Debate** |
| Not sure | **Consultation** (start simple) |

All patterns use standard Task tool spawning from `agent-spawn-protocol.md` Section 2.

---

## V2V Operating Principle

> "Good delegation amplifies team intelligence. The right pattern at the right time turns individual expertise into collective wisdom."
