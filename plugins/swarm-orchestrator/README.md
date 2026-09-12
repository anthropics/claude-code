# Swarm Orchestrator Plugin

DAG-based multi-agent orchestration for Claude Code Teams. Adds dependency-aware task graphs, role-specific subagents (Scanner / Reviewer / Builder / Merger / Test-Runner / Auditor), an abort-marker contract, worktree GC, and an opt-in reviewer-checkpoint hook — all on top of vanilla Teams without breaking existing TaskCreate / TaskUpdate / SendMessage schemas.

## Why

Vanilla Teams gives you a flat list of tasks and a generic worker. That's enough for short, linear workflows. For anything bigger — a multi-step refactor, a parallel feature batch, a multi-day audit — you end up hand-managing dependencies, watching stalled workers, cleaning up worktrees, and writing the same "is this still on track?" prompt over and over.

`swarm-orchestrator` codifies the patterns I found myself rebuilding repeatedly:

- **DAG dispatch**: declare blockers up-front; the next layer fires the moment its blockers complete. No babysitting.
- **Role-specific heads**: a Scanner that only files tasks; a Reviewer that's read-only and concise; a Merger that's git-only; an Auditor that produces docs. Each with tool restrictions baked in.
- **Self-correction**: the reviewer-checkpoint hook fires every N turns inside long-running Builders, prompting them to verify DAG status, commit count, spend, and tractability. No more 30-turn thrash loops.
- **Graceful exits**: a standard `<worktree>/.claude/abort-<name>` marker contract. Drop the file; the head commits WIP and exits cleanly. The orchestrator routes the partial result.
- **Worktree GC**: after every successful merge, dead worktrees disappear automatically.

## Install

```bash
# from inside Claude Code:
/plugin install swarm-orchestrator

# or in your project's .claude/settings.json:
{
  "plugins": ["swarm-orchestrator"]
}
```

The plugin lives in this repository under `plugins/swarm-orchestrator/`. No external dependencies — pure stdlib + the standard plugin SDK.

## Quickstart

```
/swarm-spawn Refactor src/parser.py to use the visitor pattern; add tests; merge in one PR.
```

The plugin proposes a DAG, you approve it, and the swarm runs:

```
[scan]   ──►  [base-visitor]  ──►  [node-visitors]  ──►  [tests]  ──►  [review]  ──►  [merge]
scanner       builder              builder              builder      reviewer       merger
```

When you want to peek:

```
/swarm-status
```

When you want to stop one task:

```
/swarm-status cancel <task-id>
```

When you're ready to land everything green:

```
/swarm-merge
```

## Architecture

```
                       ┌─────────────────────┐
   /swarm-spawn  ───►  │  Orchestrator turn   │
                       │  (this Claude session)│
                       └──────────┬───────────┘
                                  │
                                  │  TeamCreate + TaskCreate(blockedBy=[...])
                                  ▼
                       ┌──────────────────────┐
                       │  Vanilla Teams        │
                       │  (TaskList / state)   │
                       └──────────┬───────────┘
                                  │  dispatches (Task tool)
              ┌───────────────────┼────────────────────┐
              ▼                   ▼                    ▼
         ┌─────────┐         ┌─────────┐           ┌─────────┐
         │ Scanner │         │ Builder │   ...     │ Merger  │   (subagent_types)
         └────┬────┘         └────┬────┘           └────┬────┘
              │                   │                    │
              │  TaskCreate       │  TaskUpdate(done)  │  TaskUpdate(merged)
              ▼                   ▼                    ▼
                       ┌──────────────────────┐
                       │  PostToolUse hook     │
                       │  on_task_complete.py  │
                       │  → cascade-events     │
                       └──────────┬───────────┘
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │  Orchestrator         │
                       │  re-dispatches frontier│
                       └──────────────────────┘
```

State that lives on disk:

| Path | Purpose |
|---|---|
| `~/.claude/teams/<team>/swarm-dag.json` | The DAG: nodes, edges, status. Atomic tmp+rename writes. |
| `~/.claude/teams/<team>/cascade-events.jsonl` | Append-only log of every state transition. Fuel for replay + post-mortem. |
| `~/.claude/teams/<team>/cost-ledger.jsonl` | Per-head token + dollar spend. Used by `/swarm-status`. |
| `~/.claude/teams/<team>/test-logs/<task-id>.log` | Test-Runner output for the merge gate. |
| `~/.claude/teams/<team>/staging/` | Merger's staging clone. |
| `<repo>/.claude/abort-<head-name>` | Operator's signal to a head to commit WIP and exit. |

## Slash commands

| Command | Purpose |
|---|---|
| [`/swarm-spawn`](commands/swarm-spawn.md) | Decompose a goal into a DAG, create the team + tasks, dispatch the unblocked frontier. |
| [`/swarm-status`](commands/swarm-status.md) | Read-only view of every running swarm: DAG topology, head activity, blockers, abort markers, spend. Supports `--watch` and `--json`. |
| [`/swarm-merge`](commands/swarm-merge.md) | Run the merge pipeline against every `completed` task. Topo-orders by file overlap. Supports `--dry-run`. |

## Subagents (heads)

| Head | Role | Tools |
|---|---|---|
| [`scanner`](agents/scanner.md) | Read-only reconnaissance. Files new tasks. | Glob, Grep, LS, Read, TaskCreate |
| [`reviewer`](agents/reviewer.md) | Read-only checkpoint. Inspects DAG / commits / spend / tractability. | Glob, Grep, LS, Read, TaskList |
| [`builder`](agents/builder.md) | The default worker. Full toolkit. | Bash, Edit, Write, Read, … |
| [`merger`](agents/merger.md) | Bash + git only. Runs the merge pipeline. | Bash, Read, TaskList, TaskUpdate |
| [`test-runner`](agents/test-runner.md) | Read + Bash (test runners). The merge gate. | Bash, Read, TaskList, TaskUpdate |
| [`auditor`](agents/auditor.md) | Read-only. Produces audit / research docs. | Glob, Grep, LS, Read, WebFetch, WebSearch |

## Hooks

| Event | Hook | Purpose |
|---|---|---|
| `PostToolUse` (on `TaskUpdate`) | [`on_task_complete.py`](hooks/on_task_complete.py) | When a task hits `completed` or `merged`, log a cascade event and surface newly-unblocked tasks. |
| `Stop` | [`reviewer_checkpoint.py`](hooks/reviewer_checkpoint.py) | Inside Builder sessions, every N turns past a configurable floor, inject a self-review prompt into the next system message. |

Both hooks are pure Python stdlib, idempotent, and never block the underlying tool call — they exit 0 even on internal error and log to `~/.claude/swarm-orchestrator-hook.log`.

## Configuration

Drop `.claude/swarm-orchestrator.json` in your project root:

```json
{
  "max_parallel": 4,
  "default_target_branch": "main",
  "file_overlap_threshold": 0.3,
  "reviewer_checkpoint": {
    "enabled": true,
    "every_n_turns": 3,
    "floor": 6
  },
  "merge": {
    "target_branch": "main",
    "test_gate_command": "pytest -q",
    "use_pr_for_protected_branches": true,
    "max_parallel_merges": 1
  },
  "worktree_gc_on_merge": true
}
```

Every key is optional. Defaults are reasonable for most projects.

## Worked examples

- [Refactor a Python module](examples/refactor_python_module.md) — small fan-out, linear chain, full PR.
- [Build a feature with tests + review](examples/feature_with_review.md) — serial chain, reviewer-driven iteration.
- [Multi-day audit](examples/multi_day_audit.md) — read-only, parallel, produces markdown.

## FAQ

### How is this different from vanilla Teams?

Vanilla Teams already supports `blockedBy` on TaskCreate. The plugin doesn't add new schema fields — it adds the **iterator** (`TaskList.unblocked()`), the **cascade hook** (auto-dispatch when blockers complete), and a **set of role-specific subagents** with tool restrictions. Your existing Teams workflow keeps working unchanged; you opt in by using `/swarm-spawn` instead of hand-creating tasks.

### Does it replace the `Task` tool?

No. The plugin uses `Task` under the hood for every dispatch. The Scanner / Reviewer / Builder / etc. are all standard `subagent_type` registrations.

### Can I mix swarm tasks with hand-created tasks in the same team?

Yes. The plugin only mutates tasks it created. Hand-created tasks live alongside swarm tasks in the same team without interference.

### What happens if a head crashes?

The hook logs the event but doesn't auto-respawn (yet — that's the meta-supervisor follow-up; see [Roadmap](#roadmap)). The operator sees a stalled task in `/swarm-status` and can `cancel` + `re-spawn` manually, or drop an abort marker if the worktree has recoverable WIP.

### Can I run multiple swarms at once?

Yes. Each `/swarm-spawn` creates a new team. State files are namespaced by team name, so two swarms can run concurrently without colliding. They share the global `max_parallel` cap, however — set it conservatively if you fan out aggressively.

### Does the reviewer-checkpoint hook charge tokens?

Yes — the checkpoint emits a small system-message prompt (~80 tokens) to the Builder it fires inside. The Builder then either continues normally (free, since the prompt is in-band) or invokes the full Reviewer subagent (which costs the Reviewer's turn). You can disable the hook entirely in config if you prefer manual review cadence.

## Comparison vs. vanilla Teams

| Feature | Vanilla Teams | swarm-orchestrator |
|---|---|---|
| `blockedBy` field on TaskCreate | yes | yes (used) |
| Auto-dispatch on blocker completion | no | yes (via hook) |
| Role-specific subagent types | no (one generic worker) | yes (6 heads) |
| Tool restriction per role | manual | declared in agent frontmatter |
| Worktree GC | manual | automatic on merge |
| Abort-marker contract | none | standard |
| Reviewer checkpoint cadence | manual | hook-driven |
| Merge with file-overlap topo-sort | manual | `/swarm-merge` |
| Test gate before merge | manual | `test-runner` head + Merger gate |

## Performance

Measured on a M3 Max with the test suite in this repo:

| Metric | Target | Measured |
|---|---|---|
| Hook poll latency | < 100 ms | ~25 ms (median) |
| Cascade event write | < 50 ms | ~8 ms |
| `TaskList.unblocked()` for 100 tasks | < 10 ms | ~2 ms |
| `swarm-spawn` dispatch (excluding worktree creation) | < 5 s | ~1.2 s |

The hot path is `on_task_complete.py`: it must run in well under a second so a TaskUpdate doesn't visibly stall. I keep it stdlib-only and read-mostly to hit that.

## Roadmap (post-PR follow-ups)

The first PR ships the smallest valuable surface area. These are tracked for follow-up:

- **Meta-supervisor daemon** — long-running session that polls inboxes, respawns dead heads, and routes audit findings into new tasks.
- **Pattern-detection classifier** — offline-trained model from the cascade-event log; predicts `task_description → success_probability` and `task_description → parallelism_safety`.
- **Cross-machine SendMessage** — multi-host fleet management once Anthropic's `--remote-control` API stabilizes.
- **Mind-page UI** — optional web dashboard subscribing to `~/.claude/teams/.status.json`.
- **Provider auto-rotation** — fallback Claude → Gemini → local on rate-limit hit.
- **GitHub issues mirror** — sync swarm tasks ↔ GitHub issues for visibility outside the laptop.
- **File-overlap-reject** — pre-flight check that blocks parallel dispatch when `parallelism_safety=caution` and the file estimate overlaps too much.

## Contributing

PRs welcome. The plugin lives at `plugins/swarm-orchestrator/`; tests are in `tests/`. To run them:

```bash
cd plugins/swarm-orchestrator
# unit tests for hooks + plugin manifest:
python3 -m unittest tests.test_hooks -v
# end-to-end toy-swarm scenarios (10 scenarios; in-process reference engine):
python3 tests/swarming/run_scenario.py --all
```

Stdlib only; no extra deps.

### Scenario substrate

`tests/swarming/` ships ten binding-agnostic toy scenarios that exercise every primitive (DAG dispatch, heads architecture, abort-marker contract, file-overlap-reject, multi-team coordination, respawn-on-crash). The same scenario JSON drives any host that implements the `ScenarioEngine` protocol, so a future plugin-native engine adapter (`swarm_orchestrator.scenario_engine.PluginScenarioEngine`) drops in without rewriting the scenarios. Today every scenario falls back to the in-process reference engine in `tests/swarming/runner/stub.py`, which gives CI a green signal independent of binding readiness.

## License

Plugin contents licensed under Apache 2.0 (see [LICENSE](LICENSE) in this directory). The umbrella `claude-code` repository is governed by [Anthropic's Commercial Terms](../../LICENSE.md); on merge, Anthropic may relicense to align with the repository's primary license — a separate `LICENSE` file in this directory keeps the original contribution terms unambiguous.

## Author

Kushal Jaligama (kjaligusa@gmail.com).
