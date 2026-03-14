# Agent Teams Pipeline

Lifecycle management for Claude Code's Agent Teams feature.

## Problem

Claude Code's Agent Teams feature lacks lifecycle management, leading to:

- **Orphaned agents** that continue running after their team is deleted ([#18405](https://github.com/anthropics/claude-code/issues/18405), [#20369](https://github.com/anthropics/claude-code/issues/20369), [#25180](https://github.com/anthropics/claude-code/issues/25180))
- **Leaked tmux panes** not cleaned up on shutdown ([#24385](https://github.com/anthropics/claude-code/issues/24385))
- **Runaway agent spawning** with no limit on concurrent teammates ([#25131](https://github.com/anthropics/claude-code/issues/25131))
- **Context exhaustion freeze** (-ing bug) when context exceeds 60% ([#24585](https://github.com/anthropics/claude-code/issues/24585))
- **Post-pipeline thinking loops** when continuing work after pipeline completion ([#24414](https://github.com/anthropics/claude-code/issues/24414))

This plugin provides 7 hooks, a cleanup script, and a multi-phase pipeline orchestration skill that solve these problems.

## Installation

```bash
/plugin install agent-teams-pipeline@claude-plugin-directory
```

Or browse in `/plugin > Discover`.

## What's Included

### Hooks (7)

| Hook | Event | What It Does |
|------|-------|-------------|
| `check-context-preemptive.sh` | PreToolUse | Blocks `ExitPlanMode` and `TeamCreate` when context exceeds 55%, preventing the -ing freeze |
| `detect-pipeline-complete.sh` | Stop | Detects "Pipeline Complete" in output, sets flag, warns user to start a fresh session |
| `block-after-pipeline.sh` | PreToolUse | Blocks heavy tools (`Edit`, `Write`, `Task`, `TeamCreate`) after Pipeline Complete |
| `check-idle-reason.sh` | TeammateIdle | Detects orphan agents (team config deleted), auto-cleans inactive tmux panes, validates deliverables |
| `check-team-limit.js` | PreToolUse | Limits concurrent active teammates to 3 (prevents tmux race conditions) |
| `verify-phase-output.sh` | TaskCompleted | Validates pipeline agent deliverables on task completion (file existence, min size, PASS/FAIL verdict) |
| `check-context-stop.sh` | Stop | Suggests starting a fresh session when context exceeds 75%, with retry guard (max 2 blocks) |

### Cleanup Script

`scripts/cleanup-team-panes.sh` — Manual tmux pane cleanup with three modes:

```bash
# Clean panes for a specific team
/agent-teams-pipeline:cleanup-team-panes my-team

# Clean all teams
/agent-teams-pipeline:cleanup-team-panes --all

# Find and kill orphaned agent processes
/agent-teams-pipeline:cleanup-team-panes --orphans
```

### Pipeline Orchestration Skill

An optional multi-phase pipeline protocol for structured feature development with Agent Teams. The skill provides:

- Phase transition protocol with blocking shutdown
- Adaptive phase selection (P-1 Research through P4 Documentation)
- Agent naming conventions (`p-` prefix)
- File ownership enforcement
- Failure recovery procedures

## Configuration

### Thresholds

The default thresholds are tuned from production experience:

| Threshold | Value | Rationale |
|-----------|-------|-----------|
| Context preemptive block | 55% | All -ing incidents observed at 60-64% |
| Context stop suggestion | 75% | Model gets stuck at 80%+ |
| Max active teammates | 3 | Prevents tmux race conditions |
| Min deliverable size | 200 chars | Prevents empty/stub files |
| Stop hook retry guard | 2 blocks max | Prevents infinite block loops |

To customize thresholds, edit the hook scripts directly after installation.

### Requirements

- **jq** — Required for JSON parsing in hook scripts
- **tmux** — Required for pane cleanup (only if using tmux-based agent spawning)
- **Node.js** — Required for `check-team-limit.js`

## How It Works

### Context Management

The plugin monitors context window usage at two levels:

1. **55% (PreToolUse)** — Blocks `ExitPlanMode` and `TeamCreate` to prevent starting new heavy work that would push context into the danger zone.

2. **75% (Stop)** — When the model tries to stop, suggests creating a fresh session. Includes a retry guard that allows the stop after 2 blocks to prevent infinite loops.

### Pipeline Lifecycle

When the pipeline completes:

1. `detect-pipeline-complete.sh` detects "Pipeline Complete" in output and sets a flag file in `/tmp/`
2. `block-after-pipeline.sh` reads the flag and blocks heavy operations
3. User is warned to start a fresh session before continuing

### Orphan Detection

When a teammate goes idle:

1. `check-idle-reason.sh` checks if the team config directory still exists
2. If deleted (team was cleaned up), agents with `p-` prefix are told to exit
3. Background process auto-cleans inactive tmux panes using atomic `mkdir` locking (macOS-compatible, no `flock`)

### Team Size Enforcement

`check-team-limit.js` reads the team config and counts active non-lead members. If >= 3, blocks the `Task` tool from spawning more teammates.

## Troubleshooting

### "Context is at X% — too high to start..."

Run a session clone or restart to create a new session with recent context, then retry.

### "Pipeline Complete was detected..."

Start a fresh session. The current session's context is too large for new work.

### Orphan agents still running

Run `/agent-teams-pipeline:cleanup-team-panes --orphans` to scan for and kill leaked agent processes.

### Hook not triggering

1. Verify the plugin is installed: `/plugin list`
2. Check that `jq` is installed: `which jq`
3. Check hook logs in stderr output

## Platform Support

- **macOS** — Full support (uses `mkdir` atomic locking instead of `flock`, `stat -f` for file timestamps, `md5` for hashing)
- **Linux** — Full support (uses `flock` alternative, `stat -c` for timestamps, `md5sum` for hashing)

## License

MIT
