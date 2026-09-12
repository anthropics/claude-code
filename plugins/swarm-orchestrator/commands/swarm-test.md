---
description: Spin up a demo swarm team and populate the native Teams agent-list view with role-typed heads — proves the integration works.
argument-hint: [team-name]
allowed-tools: TeamCreate, TaskCreate, Agent, Bash, Read
---

# /swarm-test

The fast demonstration of swarm-orchestrator integrated with native Anthropic Teams.

Spins up a team called `swarm-test-<timestamp>` (or your provided name), files a 5-task DAG that exercises every role-typed head (Scanner / Builder / Test-Runner / Reviewer / Merger), and dispatches them as native Anthropic team members. The agents appear in the native CLI's agent-list view (the minimal `● main / ○ teammate-name` list at the bottom of the screen) so you can see swarm-orchestrator integrating cleanly with the binary's own surface.

## What you'll see

After running `/swarm-test`:

1. **Native Teams view populated**: the agent list shows the spawned heads — `scanner`, `builder`, `test-runner`, `reviewer`, `merger` — each with their runtime + token usage tracked by the binary's own accounting.
2. **DAG status surfaces**: tasks show `pending` / `blocked` / `in_progress` / `done` in the task list panel; the auto-cascade hook (`PostToolUse(TaskUpdate)`) re-evaluates the frontier on every completion.
3. **Role-specific tool access**: each head only has the tools its frontmatter allowlist permits — Reviewer is read-only, Merger is Bash + git, etc.
4. **Inbox traffic** between heads is visible via the native `SendMessage` tool, which the plugin layers cross-team routing on top of.

## Usage

```
/swarm-test              # spawns a team named swarm-test-<unix-timestamp>
/swarm-test my-demo      # spawns a team named "my-demo"
```

## How it relates to the standalone library

This command exercises **Mode B** (integrated with Anthropic Teams) from `IMPROVEMENTS_OVER_VANILLA_TEAMS.md`. The same workflow also runs standalone via `bash plugins/swarm-orchestrator/scripts/try-swarm.sh` (Mode A) — same DAG, same heads, but using the `claude-swarm` library's filesystem-backed task list instead of Anthropic's `Task*` tools.

Both modes are tested:
- Mode A: `python3 plugins/swarm-orchestrator/tests/swarming/run_scenario.py --all` (10/10 pass)
- Mode B: `/swarm-test` after the plugin is loaded; results visible in the native Teams agent list

## Cleanup

```
/swarm-status            # see the populated team
/swarm-abort <head>      # graceful exit for any specific teammate
```

The team is left in place after the demo so the agent list keeps showing it; delete it via `TeamDelete` (native built-in) when done.
