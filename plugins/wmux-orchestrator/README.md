# wmux-orchestrator

Multi-agent task orchestration for Claude Code -- decompose complex dev tasks into parallel agents coordinated through dependency-aware waves, with real-time visibility across terminal panes.

## What it does

When you hand Claude Code a large task, it works sequentially in a single terminal. wmux-orchestrator breaks that task into independent subtasks, assigns each to a separate Claude Code instance, and runs them in parallel across wmux terminal panes. Agents are organized into waves: wave 1 handles foundations (types, shared interfaces), subsequent waves handle work that depends on earlier output, and a final automated reviewer checks cross-agent consistency and fixes minor issues. The result is faster execution with full visibility -- you watch every agent work in real-time and can intervene in any pane mid-flight.

## How it works

```
You: /wmux:orchestrate "Refactor the auth system"

  Phase 1   Analyze codebase, trace imports, identify file boundaries
  Phase 2   Present wave plan for approval

            +-----------------------------------------------------+
            |                                                     |
  Wave 1    |  [Agent A: shared types]                            |
            |                                                     |
            +-----------------------------------------------------+
                          |  results passed down
            +-----------------------------------------------------+
            |                                                     |
  Wave 2    |  [Agent B: auth service]    [Agent C: middleware]   |
            |        (parallel)                (parallel)         |
            +-----------------------------------------------------+
                          |  results passed down
            +-----------------------------------------------------+
            |                                                     |
  Wave 3    |  [Agent D: tests + integration]                     |
            |                                                     |
            +-----------------------------------------------------+
                          |
            +-----------------------------------------------------+
            |  [Reviewer: consistency check, auto-fix, report]    |
            +-----------------------------------------------------+

  Phase 9   Summary -> commit / view diff / abort
```

Each agent gets a strict file zone (allowed and excluded files), the previous wave's results, and a standardized result format. Hooks drive wave transitions automatically -- no polling, no daemon.

## Quick start

Install the plugin:

```
/plugin install wmux-orchestrator
```

Run it:

```
/wmux:orchestrate "Refactor the auth system to use JWT tokens"
```

What happens next:

1. The orchestrator analyzes your codebase and builds a wave plan
2. You see the plan with agent assignments, file zones, and wave dependencies
3. You approve, adjust, or cancel
4. On approval, agents spawn across wmux panes (or as native subagents without wmux)
5. A live markdown dashboard tracks progress per agent
6. When all waves finish, the reviewer checks consistency, runs tests, and fixes minor issues
7. You get a summary with options: commit, view diff, or abort

## With vs without wmux

The plugin works in both environments. wmux provides the full experience; without it, you get the same orchestration logic through Claude Code's native Agent tool.

| Capability              | With wmux                          | Without wmux (degraded)         |
|-------------------------|------------------------------------|---------------------------------|
| Task decomposition      | Full analysis + wave planning      | Same                            |
| Plan presentation       | Structured plan with approval      | Same                            |
| Agent execution         | Visible panes via `wmux agent spawn` | Invisible native subagents    |
| Real-time dashboard     | Live markdown pane                 | Text summary in terminal        |
| User intervention       | Focus any pane, type directly      | Not possible                    |
| Wave transitions        | Automatic via hooks + wmux CLI     | Automatic via hooks + Agent tool|
| Reviewer                | Dedicated pane                     | Native subagent                 |
| Multi-agent visibility  | Watch all agents simultaneously    | Single spinner                  |

## Features

- **Wave-based orchestration** -- dependency-aware sequential waves with intra-wave parallelism (up to 5 agents per wave)
- **Strict file zones** -- each agent gets explicit allowed/excluded file lists to prevent conflicts
- **Result chaining** -- each wave's agents receive the previous wave's results for context continuity
- **Automated reviewer** -- checks type compatibility, import chains, orphaned exports; auto-fixes minor issues
- **Live dashboard** -- markdown pane updated in real-time with per-agent status, tool use counts, and activity log
- **Crash recovery** -- `SessionStart` hook detects interrupted orchestrations and offers to resume
- **Decomposition patterns** -- built-in guide for layer-based, feature-based, component-based, and migration splits
- **Graceful degradation** -- full functionality without wmux using Claude Code's native Agent tool
- **Git worktree isolation** -- optional `--worktree` flag to isolate each agent in a separate worktree

## Architecture

The plugin uses three coordination layers:

- **Skills** handle the intelligence: codebase analysis, task decomposition, plan presentation, and review. The orchestrator skill drives the main flow; the reviewer skill runs after all waves complete.
- **Hooks** handle reactivity: `PostToolUse` tracks agent activity, `SubagentStop` triggers wave transitions, `SessionStart` handles crash recovery, `Stop` warns about active orchestrations.
- **Scripts** handle wmux operations: spawning agents in panes, updating the dashboard, managing state, and collecting results.

The shared coordination layer is a JSON state file in a temp directory (`/tmp/wmux-orch-{id}/`), written by scripts and read by skills. No daemon, no persistent process -- purely event-driven.

## Plugin structure

```
wmux-orchestrator/
  .claude-plugin/
    plugin.json                     # Plugin manifest (name, version, metadata)
  commands/
    orchestrate.md                  # /wmux:orchestrate slash command entry point
  skills/
    orchestrate/
      SKILL.md                      # Core orchestration: analyze, decompose, plan, launch
      references/
        decomposition-guide.md      # Patterns for splitting tasks into agents
    reviewer/
      SKILL.md                      # Post-orchestration review and auto-fix
    wmux-detect/
      SKILL.md                      # Detect wmux availability, set fallback mode
  hooks/
    hooks.json                      # PostToolUse, SubagentStop, Stop, SessionStart
  agents/
    wmux-worker.md                  # Worker agent template (file zones, result format)
  scripts/
    orchestration-state.sh          # State file read/write helpers
    spawn-agents.sh                 # Launch agents for a wave via wmux CLI
    check-status.sh                 # Read-only status check for dashboard
    collect-results.sh              # Aggregate agent result files
    update-dashboard.sh             # Refresh the live markdown dashboard
    detect-wmux.sh                  # Check if wmux is running (pipe test)
    on-tool-use.sh                  # Hook: increment tool use counter
    on-agent-stop.sh                # Hook: wave transition logic
    on-stop.sh                      # Hook: warn if orchestration is active
    on-session-start.sh             # Hook: crash recovery check
    cleanup.sh                      # Remove orchestration temp files
  package.json
```

## Requirements

- **Claude Code** -- the plugin runs inside Claude Code's plugin system
- **bash** -- all scripts target bash (available on Windows via Git Bash/MSYS2, which Claude Code uses by default)
- **Node.js** -- used by scripts for JSON state manipulation (always available since Claude Code runs on Node.js)
- **wmux** (optional) -- required for the full multi-pane visual experience; without it, the plugin falls back to native Claude Code subagents

## Links

- **wmux** -- [wmux.org](https://wmux.org)
- **GitHub** -- [github.com/amirlehmam/wmux](https://github.com/amirlehmam/wmux)
- **License** -- MIT
