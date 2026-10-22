# parallel-batch-safe

Run parallel `claude -p` batch jobs without losing VS Code/Cursor extension authentication.

## The Problem

Running 10+ parallel `claude -p` from VS Code/Cursor causes the extension to lose authentication due to an OAuth refresh token race condition on the shared macOS Keychain entry. This affects every user running concurrent sessions.

**Related issues:** [#24317](https://github.com/anthropics/claude-code/issues/24317), [#37512](https://github.com/anthropics/claude-code/issues/37512), [#37203](https://github.com/anthropics/claude-code/issues/37203), [#37324](https://github.com/anthropics/claude-code/issues/37324), [#37468](https://github.com/anthropics/claude-code/issues/37468)

## How It Works

**Strategy: prevent token refresh, don't fix the race.**

Workers run in detached tmux sessions (separate process tree from VS Code/Cursor). The token is pre-refreshed before batch start with a 2-hour gate, ensuring no worker ever triggers a refresh during execution.

| Feature           | Details                                                 |
| ----------------- | ------------------------------------------------------- |
| tmux isolation    | Same as Terminal.app (proven 48/48, 0 kickouts)         |
| Token gate        | 2h minimum — refuses batch if token too short           |
| Pre-batch refresh | Single-process refresh before starting workers          |
| Retry             | Exponential backoff + jitter (prevents thundering herd) |
| Timeout           | 5-min per-job hard kill for hung workers                |
| Prompt handling   | Via temp file (no shell arg overflow)                   |
| Idempotent        | Re-run skips completed results                          |

## Installation

1. Install the plugin: copy the `parallel-batch-safe` directory to your project's `.claude/plugins/` or use as a global plugin
2. Ensure tmux is installed: `brew install tmux`
3. Add `scripts/claude-batch` to your PATH, or the `/batch` command will use the bundled copy

## Usage

### Via slash command

```
/batch
```

Claude will guide you through setting up a batch run.

### Via script directly

```bash
# Drop-in replacement for claude -p
./scripts/claude-batch -p "your prompt" --model sonnet

# Batch mode
./scripts/claude-batch batch -f prompts/ -p 10 -m sonnet -o results/

# Check token health
./scripts/claude-batch check
```

## Test Results

| Scenario    | Without plugin        | With plugin          |
| ----------- | --------------------- | -------------------- |
| 10 parallel | Extension kicked out  | Extension safe       |
| 30 parallel | Extension kicked out  | Extension safe       |
| 800+ batch  | Fails after ~60 calls | Completes with retry |

## How It Was Built

Designed through multi-model consilium (7 models, 5 rounds), 3 code review rounds (6/6 SHIP), red team analysis (5 agents, 12 attack vectors), and strategy validation (6/6 APPROVE).

Detailed analysis: [claude-batch repo](https://github.com/LARIkoz/claude-batch)
