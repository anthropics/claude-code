# Principles Context

This folder tracks adherence to the **8 Operating Principles** over time.

## Purpose

The principles are not just guidelines—they're functional guardrails embedded into the V2V Operating System. This context layer helps track how well the organization is applying them.

## The 8 Operating Principles

1. **End-to-End Ownership**: Single owners from strategy through execution
2. **Decision Quality**: The core metric for product leadership
3. **Customer Obsession**: Always trace decisions to customer value
4. **Clarity and Confidence**: Move fast with clear direction
5. **Outcomes Over Outputs**: Measure what matters, not just what ships
6. **Collaborative Excellence**: Partner productively across functions
7. **Continuous Learning**: Every outcome is a learning opportunity
8. **Scalable Systems**: Build for 10x, not just current scale

## Files in This Folder

| File | Purpose |
|------|---------|
| `scorecard.md` | Periodic assessment of principle adherence |

## Skills That Enforce Principles

| Principle | Validator Skill | When to Use |
|-----------|----------------|-------------|
| #1 End-to-End Ownership | `/ownership-map` | Before major commitments |
| #3 Customer Obsession | `/customer-value-trace` | When making decisions |
| #6 Collaborative Excellence | `/collaboration-check` | For cross-functional work |
| #8 Scalable Systems | `/scale-check` | Before committing resources |

## How to Use

### Track Principle Adherence
Run `/decision-quality-audit` periodically to assess decision quality, which reflects principle application.

### Validate Decisions Against Principles
Before finalizing major decisions:
1. `/customer-value-trace` - Does this trace to customer value?
2. `/ownership-map` - Is there single accountability?
3. `/collaboration-check` - Were stakeholders consulted?
4. `/scale-check` - Will this work at scale?

### Update Scorecard
After outcome reviews or retrospectives, update the scorecard to reflect learnings about principle adherence.

## Connection to V2V Flow

Principles are embedded at key transition points:

- **Phase 1→2**: Customer evidence required (Principle #3)
- **Phase 2→3**: Ownership chain validated (Principle #1)
- **Phase 3→4**: Collaboration check complete (Principle #6)
- **Phase 5→6**: Outcomes vs outputs analyzed (Principle #5)
- **Phase 6→1**: Learnings captured (Principle #7)
