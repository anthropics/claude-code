---
description: Spawn a swarm — a team plus a DAG of dependency-linked tasks dispatched to role-specific subagents.
argument-hint: "<goal-description> [--heads scanner,builder,reviewer,merger] [--max-parallel N]"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "TodoWrite", "Task", "TeamCreate", "TaskCreate", "TaskUpdate", "TaskList", "SendMessage"]
---

# Swarm Spawn

Spawn a multi-agent swarm: a team with role-specific subagent heads, plus a dependency-aware task graph (DAG) where each task declares its `blockedBy` / `blocks` edges and only dispatches once its blockers complete.

**Goal:** $ARGUMENTS

## What this does vs. vanilla Teams

| | Vanilla Teams | swarm-orchestrator |
|---|---|---|
| Task dispatch | One-at-a-time, manual | Topo-ordered, auto-cascade on blocker completion |
| Roles | One generic `worker` agent type | Scanner / Reviewer / Builder / Merger / Test-Runner / Auditor with tool-restricted prompts |
| Graceful exit | Implicit | Standard `<worktree>/.claude/abort-<name>` marker |
| Worktree cleanup | Manual `git worktree remove` | `swarm-orchestrator:worktree-gc` hook |
| Parallel safety | None | `file_overlap_check` before fan-out |

## Workflow

### Phase 1: Decompose the goal into a DAG

Read the goal carefully, then plan the work as nodes + edges:

1. **Identify the heads needed.** Default loadout: 1 Scanner, N Builders, 1 Reviewer, 1 Merger. Add Test-Runner if the repo has a CI suite, Auditor if the goal is research / fact-finding.

2. **Sketch the task graph.** Each node has:
   - `id` — short slug (`scan-codebase`, `impl-feature-x`, `merge-pr-12`)
   - `head` — which subagent type runs it (`scanner` / `builder` / `reviewer` / `merger` / `test-runner` / `auditor`)
   - `description` — concrete deliverable, with exit criteria
   - `blockedBy` — list of task ids that must complete first
   - `blocks` — list of task ids this unblocks (optional, derivable from inverse)
   - `parallelism_safety` — `safe` / `caution` / `serial` (default `caution`)
     - `safe` → can run alongside any sibling
     - `caution` → check `file_overlap` against running siblings before dispatching
     - `serial` → must run alone in its layer

3. **Show the plan to the operator and wait for approval.** Print the DAG as ASCII (boxes + arrows). Do not start dispatching until the operator approves or amends.

### Phase 2: Create the team + tasks

Once approved:

1. Call `TeamCreate` with the team name + brief description.
2. For each DAG node, call `TaskCreate` with:
   - `subagent_type` from the head mapping
   - `prompt` from the description
   - `blockedBy` array on TaskCreate (vanilla Teams supports it; I make it first-class)
3. Persist the DAG to `~/.claude/teams/<name>/swarm-dag.json` so `/swarm-status` and `/swarm-merge` can read it.

### Phase 3: Dispatch the unblocked frontier

1. Compute `TaskList.unblocked()` — tasks whose `blockedBy` is empty or all-completed.
2. For each unblocked task, run `file_overlap_check` against currently in-progress siblings:
   - Estimate touched files from the task description (best effort; ask the head to declare them in its first turn).
   - If overlap > threshold AND `parallelism_safety != safe`, hold the task in `pending` and log a reason.
3. Dispatch the rest (up to `--max-parallel`, default 4) by sending the start prompt to each head's subagent.

### Phase 4: Watch the cascade

The plugin's `on-task-complete` hook (see `hooks/on_task_complete.py`) re-evaluates the frontier whenever any task hits `status=completed`. New unblocked tasks dispatch automatically. The operator can interrupt with `/swarm-status pause`.

## Heads reference

- **scanner** — read-only; finds work and files new tasks. Use for "look at the repo, find N issues to fix" framings.
- **reviewer** — read-only; runs every N turns inside long-lived builders to do a self-review (DAG status / commits / spend / tractability). Configurable via the `reviewer-checkpoint` hook.
- **builder** — full toolkit; the default worker for "make a change."
- **merger** — Bash + git only; runs the merge pipeline (rebase + test gate + push).
- **test-runner** — read + Bash (pytest / npm test only); gates merges.
- **auditor** — read-only; produces audit docs without touching the tree.

## Abort contract

Every spawned head reads `<worktree>/.claude/abort-<name>` between phases. If the file exists, the head commits any WIP, pushes, and exits cleanly. The orchestrator surfaces the abort in `/swarm-status` and routes the partial result back into the DAG (typically marking the task `needs_review` rather than `completed`).

## Worktree GC

After every successful merge, the `on-task-complete` hook fires `swarm-orchestrator:worktree-gc`, which:

1. Lists `git worktree list --porcelain`.
2. For each worktree, checks if its branch is merged into the team's target branch (default: `main`).
3. Removes merged worktrees with `git worktree remove --force`.

Failures are logged but do not block dispatch.

## Examples

### Refactor a Python module

```
/swarm-spawn Refactor src/core/parser.py to use the visitor pattern; add tests; merge in one PR.
```

Likely DAG (the command will propose it; you approve):

```
[scan-parser]  ──►  [design-visitor]  ──►  [impl-visitor]  ──►  [add-tests]  ──►  [review]  ──►  [merge]
   scanner          builder              builder            test-runner      reviewer        merger
```

### Multi-feature batch

```
/swarm-spawn Land features A, B, C in parallel; A and B touch /api/, C touches /ui/. Single test gate before any merge.
```

Likely DAG:

```
[scan]  ─►  ┌─[impl-A]─┐
            ├─[impl-B]─┤  ──►  [test]  ──►  [review]  ──►  [merge]
            └─[impl-C]─┘
```

A and B will be dispatched serially (file overlap on /api/) while C runs in parallel.

### Audit-only run

```
/swarm-spawn Audit the auth subsystem for OWASP top-10 issues; produce a report at docs/audits/auth-2026-Q2.md. No code changes.
```

DAG: just one auditor node. The plugin ensures the head has read-only tools.

## Configuration

User-overridable via `.claude/swarm-orchestrator.json` in the project root:

```json
{
  "max_parallel": 4,
  "default_target_branch": "main",
  "reviewer_checkpoint_every_n_turns": 3,
  "abort_marker_pattern": ".claude/abort-{name}",
  "worktree_gc_on_merge": true,
  "file_overlap_threshold": 0.3
}
```

## Notes

- DAG state lives at `~/.claude/teams/<name>/swarm-dag.json` (atomic tmp+rename writes).
- `TaskList.unblocked()` is computed every dispatch; cheap (< 10ms for graphs of < 1000 nodes).
- The plugin does NOT replace vanilla Teams — every artifact is a standard Team / Task / SendMessage record. You can inspect the swarm with `/teams` exactly as before.
