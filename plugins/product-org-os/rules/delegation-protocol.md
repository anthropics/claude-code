---
globs:
  - "**/*"
---

# Agent Delegation Protocol

Defines structured patterns for agent-to-agent collaboration beyond basic "spawn and integrate." Each pattern has clear triggers, ownership rules, and attribution requirements.

---

## Pattern 1: CONSULTATION

The current default — agent asks another for input and integrates it into their own response.

**Trigger**: Agent needs a domain perspective they don't own
**Ownership**: Stays with the requesting agent
**Attribution**: "I consulted {emoji} {Name} who noted..."

### How It Works

1. Requesting agent identifies a gap in their expertise
2. Spawns a sub-agent with specific questions and context
3. Receives the sub-agent's input
4. Integrates findings into their own deliverable
5. Attributes the contribution

### Example

```
📝 Product Manager working on a PRD needs competitive context:

1. PM identifies: "I need to understand how competitors handle this feature"
2. PM spawns @ci: "What's the competitive landscape for [feature area]?
   Focus on top 3 competitors and their approach."
3. CI returns: Competitive analysis with positioning gaps
4. PM integrates: "Based on competitive intelligence input, our approach
   differentiates by [X]. Competitors focus on [Y] while we target [Z]."
```

### When to Use
- You need a data point or perspective, not a full deliverable
- The input will be part of a larger work product you own
- Quick turnaround needed — a focused question, not an open-ended task

---

## Pattern 2: DELEGATION

Agent hands off a complete sub-task to a specialist who owns and delivers it.

**Trigger**: Task requires specialist to own a complete deliverable
**Ownership**: Transfers to the specialist for that sub-task
**Attribution**: Specialist's output is presented directly, credited to them

### How It Works

1. Delegating agent identifies a sub-task outside their expertise
2. Defines scope, deliverable expected, and constraints
3. Spawns specialist with full ownership of the sub-task
4. Specialist produces the deliverable independently
5. Delegating agent incorporates or presents alongside their own work

### Example

```
📋 Director of PM building a roadmap delegates competitive section:

1. Dir PM identifies: "The competitive landscape section needs deep analysis"
2. Dir PM spawns @ci: "[DELEGATION] Own the competitive landscape section
   for the Q3 roadmap. Deliver a competitive positioning analysis covering
   [scope]. Constraints: Focus on enterprise segment, include pricing comparison."
3. CI produces: Complete competitive analysis document
4. Dir PM incorporates: "The competitive landscape analysis (by 🔭 CI)
   shows [key findings]. Full analysis: `[path/competitive-analysis.md]`"
```

### When to Use
- Sub-task requires deep specialist expertise
- You want the specialist's voice and judgment, not just data
- The deliverable stands on its own (can be referenced separately)
- You want to parallelize work — delegate and continue with your part

### Protocol Format

When delegating, include in the prompt:
```
[DELEGATION] to @{agent} for {deliverable}
Scope: {what to cover}
Deliverable: {what to produce}
Constraints: {boundaries, focus areas}
Context: {relevant background from your work}
```

When receiving delegation:
```
Taking this on. I'll deliver {deliverable} focused on {scope}.
{... specialist work ...}
```

---

## Pattern 3: REVIEW

Agent requests structured review from a peer or senior before finalizing.

**Trigger**: Deliverable needs quality validation before publishing
**Ownership**: Original agent owns the final output; reviewer provides feedback
**Attribution**: "Reviewed by {emoji} {Name}. Key feedback: [summary]"

### How It Works

1. Author agent produces a draft deliverable
2. Identifies appropriate reviewer (peer for quality, senior for alignment)
3. Spawns reviewer with the draft and review criteria
4. Reviewer evaluates against criteria, provides structured feedback
5. Author incorporates feedback and notes what was changed

### Example

```
📝 PM creates a PRD and requests Director review:

1. PM produces: Complete PRD for authentication feature
2. PM spawns @pm-dir: "[REVIEW] Please review this PRD for:
   - Requirements completeness
   - Alignment with Q3 roadmap themes
   - Acceptance criteria quality
   Draft: `[path/prd-auth.md]`"
3. Dir PM reviews: "Reviewed. 3 items:
   P0: Missing error handling for SSO timeout
   P1: Success criteria need baseline metrics
   P2: Consider adding edge case for expired tokens"
4. PM updates: "Incorporated Dir PM review feedback. Added SSO timeout
   handling (P0), baseline metrics (P1), and expired token edge case (P2)."
```

### Review Request Format

```
[REVIEW] by @{agent}
Deliverable: {path or inline content}
Review criteria:
- {criterion 1}
- {criterion 2}
- {criterion 3}
Context: {why this review matters now}
```

### Review Response Format

```
Reviewed by {emoji} {Name}

| Priority | Finding | Recommendation |
|----------|---------|----------------|
| P0 (Blocker) | {finding} | {recommendation} |
| P1 (Important) | {finding} | {recommendation} |
| P2 (Nice to have) | {finding} | {recommendation} |

Overall: {GO / GO WITH CHANGES / NEEDS REWORK}
```

### When to Use
- Before publishing or committing to a deliverable
- When crossing V2V phases (Phase 2→3 commitment check)
- When the deliverable affects multiple teams
- When quality bar is high (PRDs, strategic bets, launch plans)

### Reviewer Selection

| Deliverable Type | Recommended Reviewer |
|-----------------|---------------------|
| PRD, feature spec | @pm-dir (quality), @ux-lead (usability) |
| Strategic bet | @vp-product (alignment), @bizops (financials) |
| GTM plan | @pmm-dir (strategy), @prod-ops (execution) |
| Roadmap | @vp-product (vision alignment), @pm-dir (capacity) |
| Pricing | @bizops (financials), @vp-product (strategy) |

---

## Pattern 4: STRUCTURED DEBATE

Two or more agents present opposing perspectives to inform a decision.

**Trigger**: Genuine disagreement or tradeoff where both sides have merit
**Ownership**: Senior agent (or gateway) owns the synthesis and decision
**Attribution**: Each agent speaks directly; synthesis by the most senior

### How It Works

1. Gateway or senior agent identifies a genuine tradeoff
2. Assigns specific positions to agents (not just "give your opinion")
3. Each agent argues their position with evidence and reasoning
4. Agents may respond to each other's points
5. Senior agent synthesizes and recommends a path forward

### Example

```
@plt considering GTM motion for a new product:

1. PLT identifies: "Genuine tradeoff between PLG and SLG approaches"
2. Assigns positions:
   - @bizops: "Argue for Product-Led Growth. Present the case with
     evidence, risks, and success criteria."
   - @pmm-dir: "Argue for Sales-Led Growth. Present the case with
     evidence, risks, and success criteria."
3. Each presents their case (Meeting Mode format)
4. VP Product synthesizes: "Both approaches have merit. The tension is
   [X]. My recommendation: Start PLG for SMB segment, add sales motion
   for enterprise at [trigger]. Here's why..."
```

### Debate Format

**Position Assignment:**
```
[DEBATE] @{agent1} argues FOR {position A}
[DEBATE] @{agent2} argues FOR {position B}
Context: {the tradeoff being debated}
Decision owner: @{senior agent}
```

**Each Agent's Response:**
```
{emoji} {Name} — arguing for {position}:

**The Case**: [2-3 paragraphs presenting the argument]
**Evidence**: [supporting data, precedent, reasoning]
**Risks**: [what could go wrong with this approach]
**Success Criteria**: [how we'd know this was the right choice]
**Conditions**: [under what conditions this approach works best]
```

**Synthesis (by senior agent):**
```
{emoji} {Name} — synthesis:

"Having heard both perspectives, here's where I land...
[synthesis that acknowledges both sides]
[recommendation with reasoning]
[conditions for revisiting]"
```

### When to Use
- Genuine tradeoff with no obvious right answer
- Decision would benefit from structured advocacy
- Team needs to see both sides before committing
- Portfolio-level tradeoffs between competing investments

### When NOT to Use
- One option is clearly better (just decide)
- The debate would be performative (outcome predetermined)
- Time pressure doesn't allow deliberation
- Information asymmetry makes debate unfair (get data first)

---

## Pattern Selection Guide

| Situation | Pattern | Why |
|-----------|---------|-----|
| Need a data point for your work | **Consultation** | Quick input, you keep ownership |
| Need specialist to own a sub-deliverable | **Delegation** | Transfer ownership, get expert output |
| Need quality check before publishing | **Review** | Structured feedback, you keep ownership |
| Genuine tradeoff needs structured analysis | **Debate** | Multiple perspectives, senior decides |
| Not sure which pattern | **Consultation** | Start simple, escalate if needed |

---

## Integration with Spawn Protocol

All delegation patterns use the standard Task tool spawning from `agent-spawn-protocol.md` Section 2. The pattern type is communicated in the prompt:

- **Consultation**: Default behavior (no special prefix needed)
- **Delegation**: Prefix with `[DELEGATION]` and scope/deliverable/constraints
- **Review**: Prefix with `[REVIEW]` and criteria/deliverable
- **Debate**: Prefix with `[DEBATE]` and position assignment

---

## Anti-Patterns

| Anti-Pattern | Problem | Alternative |
|--------------|---------|-------------|
| Delegating what you should own | Abdicates accountability | Use Consultation instead |
| Reviewing everything | Bottleneck, slows delivery | Reserve Review for high-stakes deliverables |
| Debating obvious decisions | Wastes time, signals indecision | Just decide and document |
| Consultation chains (A->B->C->D) | Context degrades, slow | Delegate directly to the expert |
| Reviewing without criteria | Feedback is unfocused | Always specify what to review for |

---

## V2V Operating Principle

> "Good delegation amplifies team intelligence. The right pattern at the right time turns individual expertise into collective wisdom."
