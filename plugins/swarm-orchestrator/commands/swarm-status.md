---
description: Show the swarm's current state — DAG topology, head activity, blockers, abort markers, token spend.
argument-hint: "[team-name] [--json] [--watch]"
allowed-tools: ["Bash", "Read", "Glob", "Grep", "TaskList"]
---

# Swarm Status

Show the current state of every running swarm, or a specific one if `team-name` is given.

**Args:** $ARGUMENTS

## What you see

```
keepalive daemon:  alive  (pid 91168, log ~/.claude/swarm/state/daemon.log)
swarm: <team-name>           target: main           heads alive: 3 / 4
DAG (12 tasks, 8 done, 2 in_progress, 2 blocked)

  [scan-parser]      done       scanner   1.2k tok   $0.018
  [design-visitor]   done       builder   8.4k tok   $0.126
  [impl-visitor]     in_progress builder  ~12k tok   $0.180   3m elapsed
  [add-tests]        in_progress builder  ~6k tok    $0.090   3m elapsed
  [review]           blocked    reviewer  -          -        waits on impl-visitor, add-tests
  [merge]            blocked    merger    -          -        waits on review

abort markers:    none
worktrees:        4 active, 2 stale (will GC on next completion)
spend so far:     $1.42 (cap: $5.00)   token total: 94.3k
last cascade:     2026-05-10 13:42 UTC  (2m ago)
```

The first line (keepalive daemon liveness) is critical: if it shows `dead` or `no pid file`, the swarm isn't picking up new tasks. Restart with `/swarm-start`.

## Workflow

1. **Check the keepalive daemon FIRST.** Run `claude-swarm daemon-status --home ~/.claude/swarm` and surface alive/dead at the top. If dead, suggest `/swarm-start`.

2. **Locate state.** Read `~/.claude/teams/<name>/swarm-dag.json`. If the file is missing, fall back to `TaskList(team=<name>)` and reconstruct the topology from `blockedBy` fields on each task. Also surface the keepalive kanban via `claude-swarm list --home ~/.claude/swarm`.

2. **For each task, render:**
   - id, head (`subagent_type`), status
   - cumulative tokens + dollars (from `~/.claude/teams/<name>/cost-ledger.jsonl` if present)
   - elapsed time since `dispatched_at` for `in_progress` tasks
   - blockers list for `blocked` / `pending` tasks

3. **Surface meta-state:**
   - active worktrees (`git worktree list --porcelain | head`)
   - abort markers present (`find ~/.claude/teams/<name>/worktrees -name 'abort-*'`)
   - spend rollup vs. configured cap

4. **`--watch`:** redraw every 5 seconds (clear screen + reprint). Exit on Ctrl+C.

5. **`--json`:** dump the structured state to stdout, no formatting.

## Status taxonomy

- `pending` — created but not yet eligible (blockers incomplete) or held by parallelism guard
- `in_progress` — dispatched, head is running
- `completed` — head reported done, hook fired, branch merged (or skipped if no branch)
- `needs_review` — head exited via abort marker or test gate failed; operator must inspect
- `failed` — terminal error (head crashed, hard rate-limit, budget cap hit)
- `blocked` — explicit `blockedBy` task is not yet completed

## Useful follow-ups

- `/swarm-status pause <task-id>` — set the task's status to `paused`; the cascade will skip it.
- `/swarm-status resume <task-id>` — flip back to `pending`; cascade re-evaluates.
- `/swarm-status cancel <task-id>` — write the abort marker for the head; the head commits WIP and exits.
- `/swarm-merge <team-name>` — kick off the merge pipeline for any `completed` tasks with branches.
- `/swarm-status replay <team-name>` — print the timeline of every state transition for post-mortem.

## Notes

- This command is read-only — it never mutates state except via the explicit `pause` / `resume` / `cancel` subcommands.
- Cost numbers are best-effort estimates; the source of truth is each provider's billing dashboard.
