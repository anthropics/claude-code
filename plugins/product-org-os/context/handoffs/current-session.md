# Session Context Handoff

*This file is overwritten each time `/handoff` is invoked. It captures context for agent-to-agent delegation.*

---

## No Active Handoff

No handoff context has been generated yet.

When an agent needs to delegate work to another agent, use `/handoff` to capture the current context and create a briefing for the receiving agent.

---

## Handoff Template

When `/handoff` is invoked, this file will contain:

```markdown
# Session Context Handoff

*Generated: [Timestamp]*

## Delegating Agent
@[agent-name]

## Receiving Agent
@[agent-name]

## Task Being Delegated
[Clear description of what needs to be done]

## Context Inherited

### Active Strategic Bet
[If applicable - which bet this work supports]

### Relevant Decisions
[Recent decisions that constrain or inform this work]

### Constraints
- [Timeline constraints]
- [Resource constraints]
- [Technical constraints]
- [Dependencies]

### Assumptions to Preserve
[Key assumptions from the strategic context]

### Prior Discussion Summary
[Key points from the current session that the receiving agent needs]

## Expected Deliverable
[What the delegating agent expects to receive back]
```
