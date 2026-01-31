---
name: portfolio-status
description: View current state of all active strategic bets
argument-hint:
---

View the **current state** of the strategic portfolio — all active bets, their health, and upcoming checkpoints.

## V2V Phase

**Cross-phase** - This skill provides portfolio context for any strategic work.

**Prerequisites**: Strategic bets created and tracked
**Outputs used by**: All phases (ensures alignment with portfolio strategy)

## Purpose

Provides a dashboard view of what the organization is currently betting on, enabling strategic alignment and informed prioritization.

## When to Use

Invoke `/portfolio-status` when:
- Starting a strategic planning session
- Before making portfolio tradeoff decisions
- Checking alignment of new work with current bets
- Reviewing upcoming re-decision checkpoints
- PLT needs an overview of current strategic state

**Filters**:
- `product:[name]` - Filter to specific product (e.g., `/portfolio-status product:AXIA`)
- `--include-demo` - Include demo bets (marked with `[DEMO]`)
- `--demo-only` - Show only demo bets (for testing/learning)

## Process

### 1. Read Portfolio State

Read `context/portfolio/active-bets.md` to get current portfolio.

### 1b. Check for Production Data (Demo Filtering)

**Before displaying**, determine if production bets exist:

1. Check for non-demo bets:
   - Any bet ID that does NOT contain "DEMO"
   - Any bet NOT in `context/demo/` path

2. Apply demo filtering rule:
   | Production Data? | Flag | Behavior |
   |-----------------|------|----------|
   | No | (any) | Include demo with `[DEMO]` markers |
   | Yes | (none) | **Exclude demo bets**, show excluded count |
   | Yes | `--include-demo` | Include demo with `[DEMO]` markers |
   | (any) | `--demo-only` | Only demo bets |

3. Demo data is identified by:
   - ID contains "DEMO" (e.g., `SB-DEMO-001`)
   - Path contains `context/demo/`

### 2. Read Related Context

For each active bet, also check:
- `context/assumptions/registry.md` — Status of key assumptions
- `context/bets/index.md` — Full bet details if needed

### 3. Generate Status Report

```markdown
# Portfolio Status

*As of: [Current Date]*

## Executive Summary

| Metric | Count |
|--------|-------|
| Active Bets | [N] |
| Proposed (Awaiting Approval) | [N] |
| At Risk (Yellow/Red) | [N] |
| Checkpoints This Month | [N] |
| Assumptions Pending Validation | [N] |

## Active Strategic Bets

### [SB-ID]: [Bet Title]
- **Owner**: @[agent/person]
- **Product**: [Product name, if applicable]
- **Status**: Active
- **Health**: [Green/Yellow/Red] [emoji indicator]
- **Started**: [Date]
- **Next Checkpoint**: [Date] — [Type: Early signal / Mid-point / End]
- **Key Assumptions**:
  - [A-NNN]: [Assumption] — [Status]
  - [A-NNN]: [Assumption] — [Status]
- **Notes**: [Current status/blockers]

[Repeat for each active bet]

## Proposed Bets (Awaiting Approval)

| ID | Title | Owner | Proposed Date | Blocker |
|----|-------|-------|---------------|---------|
| [ID] | [Title] | @[owner] | [Date] | [What's needed] |

## Upcoming Checkpoints

| Date | Bet | Checkpoint | Decision Options |
|------|-----|------------|------------------|
| [Date] | [ID]: [Title] | [Type] | Continue / Pivot / Stop |

## At-Risk Assumptions

Assumptions that are pending validation and may affect active bets:

| Assumption ID | Assumption | Affects Bet | Due Date | Risk Level |
|---------------|------------|-------------|----------|------------|
| [A-NNN] | [Text] | [SB-ID] | [Date] | High/Med/Low |

## Dependencies

| Bet | Depends On | Status |
|-----|------------|--------|
| [ID] | [What it depends on] | [Blocked/On track] |

## Recommendations

Based on current portfolio state:
- [Recommendation 1]
- [Recommendation 2]
```

### 4. Highlight Actions Needed

Call out anything that needs attention:
- Overdue checkpoints
- At-risk bets (Yellow/Red)
- Invalidated assumptions affecting active bets
- Blocked dependencies

## Instructions

1. Parse optional `product:[name]` filter from input
2. Read `context/portfolio/active-bets.md`
3. Read `context/assumptions/registry.md`
4. Read `context/bets/index.md` for additional details
5. If product filter specified, filter results to that product only
6. Generate the status report following the format above
7. Calculate summary metrics
8. Highlight items needing attention
9. Provide actionable recommendations

## Health Indicators

Use these criteria for bet health:

| Health | Criteria |
|--------|----------|
| Green | On track, assumptions holding, no blockers |
| Yellow | Minor concerns, assumption at risk, or approaching checkpoint |
| Red | Blocked, key assumption invalidated, or significantly off track |

## Output

Present the status report in a clear, scannable format. Offer to:
- Drill into any specific bet
- Create a presentation version with `/present`
- Update the portfolio with new information
