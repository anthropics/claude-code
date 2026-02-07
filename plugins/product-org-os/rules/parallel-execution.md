---
globs:
  - "**/*"
---

# Parallel Agent Execution

Enables parallel spawning of agents for efficient cross-functional work.

## When to Parallelize

**DO parallelize when:**
- Gathering inputs from multiple functions
- Analyses don't depend on each other's output
- Time-sensitive decisions need fast input collection

**DON'T parallelize when:**
- Outputs are dependencies
- Coordination is required
- Sequence matters (V2V phase order)

## Common Parallel Patterns

| Use Case | Agents | Synthesizer |
|----------|--------|-------------|
| Portfolio Review | @bizops, @ci, @value-realization, @prod-ops | @cpo or @plt |
| Launch Decision | @pm, @pmm, @prod-ops | @pm-dir |
| Strategic Planning | @ci, @bizops, @value-realization | @vp-product |
| GTM Preparation | @pmm, @bizdev, @sales-enablement | @pmm-dir |
| Customer Review | @value-realization, @ux-lead, @pm | @vp-product |

## How to Invoke

Use multiple Task tool calls in a single message:

```
Spawning parallel agents:
[Task: @bizops - Financial analysis for Q2]
[Task: @ci - Competitive update for Q2]
[Task: @value-realization - Customer outcomes for Q2]
```

Each agent receives the same context and works independently.

## Presentation

**See `agent-spawn-protocol.md` Section 10 for presentation requirements.**

Key points:
- Show each agent's response with attribution
- Agents speak in first person
- Synthesis comes AFTER individual voices

## Guardrails

- **Max parallel agents**: 4
- **Context sharing**: All receive `/handoff`, `/portfolio-status`, `/context-recall` context
- **Conflict resolution**: Document disagreements, identify root cause, escalate if needed

## V2V Operating Principle

> "Parallel execution is about comprehensive input, not speed. Speed is a side effect of good design."
