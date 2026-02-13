---
name: pipeline-orchestration
description: This skill should be used when the user asks to "orchestrate a pipeline", "run agent teams pipeline", "manage multi-phase development", or discusses structured feature development with Agent Teams. Provides a multi-phase pipeline protocol with lifecycle management, phase transitions, and failure recovery.
---

# Pipeline Orchestration

A multi-phase pipeline protocol for structured feature development using Claude Code's Agent Teams. Provides lifecycle management, phase transitions, agent coordination, and failure recovery.

## Overview

The pipeline orchestration protocol organizes complex development work into sequential phases, each with dedicated agents, defined deliverables, and structured handoffs. It enforces agent limits, file ownership, and shutdown sequencing to prevent orphan agents and resource leaks.

## Absolute Constraints

- Max **3 simultaneous active teammates** (tmux race condition prevention)
- Lead **never modifies code directly** — delegate all implementation to teammates
- Lead does not substitute for failed teammates — **spawn a replacement**
- Default to direct messages (1:1); broadcast only for direction changes

## Agent Naming Convention

Pipeline teammates use the `p-` prefix to distinguish them from standalone agents. Never spawn standalone agents as pipeline members.

| Standalone (don't use) | Pipeline (use) |
|------------------------|----------------|
| architect | **p-architect** |
| security-reviewer | **p-sec-reviewer** |
| code-reviewer | **p-perf-reviewer**, **p-cov-reviewer** |
| planner | **p-strategist** |

## Adaptive Phase Selection

**Always required**: P0 (Design) → P1 (Implementation) → P2 (Verification)

Optional phases activate based on conditions:

| Phase | Condition to Activate |
|-------|----------------------|
| P-1 Research | New library, unfamiliar tech, migration |
| P0.5 Review | Modifying existing code (not greenfield) |
| P1.5 Integration | 3+ modules changed simultaneously |
| P3 Refactoring | QA_REPORT.md contains FAIL |
| P4 Documentation | Public API surface changed |

Skip optional phases aggressively. The minimal pipeline (P0→P1→P2) is the default.

## Phase Agent Composition

All agents use the `p-` prefix. Outputs go to `docs/pipeline/`. The DESIGN.md must include a File Ownership Map (agent→directory mapping).

### [P-1] Research

Agents: `p-research-best`, `p-research-docs`, `p-research-code`
Outputs: `RESEARCH_BEST.md`, `RESEARCH_DOCS.md`, `RESEARCH_CODE.md` (≥500 chars each)

### [P0] Design (Required)

Agents: `p-architect` (plan_mode_required), `p-critic`, `p-strategist`
Outputs: `DESIGN.md`, `DESIGN_CRITIQUE.md`, `TEST_STRATEGY.md`

### [P0.5] Review

Agents: `p-sec-reviewer`, `p-perf-reviewer`, `p-cov-reviewer`
Outputs: `REVIEW_SECURITY.md`, `REVIEW_PERFORMANCE.md`, `REVIEW_COVERAGE.md`
Note: Read-only phase — reviewers must not modify source code.

### [P1] Implementation (Required)

Agents: `p-impl-A`, `p-impl-B`, `p-test-writer`
File Ownership Map from DESIGN.md is enforced — each agent only modifies its assigned directories.

### [P1.5] Integration

Agents: `p-integ-tester`, `p-integ-fixer`, `p-regression`
Outputs: `INTEGRATION_REPORT.md`, `REGRESSION_REPORT.md`

### [P2] Verification (Required)

Agents: `p-hypo-A`, `p-hypo-B`, `p-qa`
Outputs: `VERIFY_A.md`, `VERIFY_B.md`, `QA_REPORT.md` (must contain PASS or FAIL verdict)
Verification uses adversarial debate: `p-hypo-A` and `p-hypo-B` independently evaluate, then exchange critiques via direct message.

### [P3] Refactoring

Agents: `p-cleaner`, `p-optimizer`, `p-final-review`
Triggered only when QA_REPORT.md contains FAIL.

### [P4] Documentation

Agents: `p-api-doc`, `p-changelog`, `p-readme`
Triggered only when public API surface changed.

## Phase Transition Protocol

**CRITICAL: Steps 3-5 MUST execute in exact order. Never call TeamDelete before shutdown is confirmed.**

1. `TaskList` — verify all teammates completed their tasks
2. Verify output files exist in `docs/pipeline/`
3. Each completing teammate writes a HANDOFF section at the end of their output file:

   ```markdown
   ## Handoff
   - **Attempted**: [list of approaches tried]
   - **Worked**: [what succeeded]
   - **Failed**: [what didn't work and why]
   - **Remaining**: [unfinished items for next phase]
   ```

4. `shutdown_request` each teammate → **WAIT for approval response** (do NOT proceed until all confirm)
   - If a teammate doesn't respond within 30s, send exit via tmux pane as fallback
5. Clean up tmux panes: run `cleanup-team-panes.sh [team-name]`
6. `TeamDelete` — **only after ALL teammates confirmed or panes killed**
7. Run `cleanup-team-panes.sh --orphans` (safety net: catch any leaked agents)
8. `TaskCreate` for next phase tasks (with `blockedBy` referencing completed phase IDs)
9. Spawn new teammates (include previous phase output paths in prompt)
10. Record progress in `docs/pipeline/PROGRESS.md`

## Spawn Prompt Required Items

When spawning a pipeline teammate, the prompt MUST include:

1. **Read**: Previous phase output paths to read for context
2. **Write scope**: Owned directories only (from File Ownership Map)
3. **Focus**: Specific task description
4. **Done-when**: Concrete completion criteria
5. **Output**: "Write to `docs/pipeline/[FILE].md` and send summary to team-lead"
6. **Boundary**: "Do NOT modify files outside `[owned path]`"
7. **Handoff awareness**: "Check the Handoff section at the end of input documents for context from the previous phase"

## File Handoff Structure

```
docs/pipeline/
├── PLAN.md, PROGRESS.md       ← Lead managed
├── DESIGN*.md, TEST_STRATEGY  ← P0 → P1
├── RESEARCH_*.md              ← P-1 → P0
├── REVIEW_*.md                ← P0.5 → P1
├── INTEGRATION_REPORT.md      ← P1.5 → P2
├── REGRESSION_REPORT.md       ← P1.5 → P2
├── VERIFY_*.md                ← P2 → P3 decision
└── QA_REPORT.md               ← P2 → end or P3
```

## Git Worktree Strategy (Optional)

For tasks involving multiple branches or high file-conflict risk, the lead can create git worktrees for implementation agents:

1. **Before P1**, create worktrees:
   ```bash
   git worktree add ../project-impl-A feature/impl-A
   git worktree add ../project-impl-B feature/impl-B
   ```

2. **Spawn agents** with working directory set to the worktree:
   - `p-impl-A` works in `../project-impl-A`
   - `p-impl-B` works in `../project-impl-B`

3. **After P1**, merge worktrees:
   ```bash
   git merge feature/impl-A
   git merge feature/impl-B
   ```

4. **Clean up**:
   ```bash
   git worktree remove ../project-impl-A
   git worktree remove ../project-impl-B
   ```

Benefits: Zero file ownership violations possible.
Tradeoff: Merge conflicts must be resolved in P1.5 Integration.

## Failure Recovery

| Situation | Protocol |
|-----------|----------|
| Teammate crash | Read PROGRESS.md → spawn replacement ("continue from [state]") |
| Task overdue | Reminder at 2x estimate → 3 reminders → shutdown + replace |
| File conflict | `git diff` → non-owner reverts → respawn if needed |
| Session crash | Read PROGRESS.md → resume from last completed phase |
| tmux residue | Run `cleanup-team-panes.sh [team-name]` |
| Orphan agents | Run `cleanup-team-panes.sh --orphans` |
| Config deleted before shutdown | `cleanup-team-panes.sh` auto-falls back to orphan detection |

## Pipeline Termination Protocol

After the **final phase** completes (P2 PASS, or P3/P4 if triggered):

1. Execute Phase Transition Protocol steps 1-7 for the last phase
2. Write final summary to `docs/pipeline/PROGRESS.md` with `## Pipeline Complete` header
3. **STOP** — Output final results as plain text to the user
4. Do NOT spawn new teammates, create new tasks, or start new phases
5. Do NOT attempt to manage or communicate with teammates after TeamDelete

**Shutdown sequence is BLOCKING:** Do not proceed to TeamDelete until all teammates have either:
- Confirmed shutdown (`shutdown_response` with `approve=true`), OR
- Been force-killed via tmux pane cleanup

**Resume after session crash:**
- Read `docs/pipeline/PROGRESS.md`
- If it contains `## Pipeline Complete` → report results, do NOT restart pipeline
- If it does NOT contain `## Pipeline Complete` → resume from last completed phase
- If team config no longer exists → do NOT attempt SendMessage to old teammates
- Always run `cleanup-team-panes.sh --orphans` on resume
