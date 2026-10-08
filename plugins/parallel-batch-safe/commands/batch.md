---
allowed-tools: Bash(claude-batch:*), Bash(tmux:*), Bash(cat:*), Bash(ls:*), Bash(wc:*)
description: Run parallel claude -p batch jobs safely (no auth kickout)
---

## Context

This command runs parallel `claude -p` jobs without causing VS Code/Cursor extension authentication loss.

**Problem:** Running 10+ parallel `claude -p` from the VS Code Bash tool causes a Keychain race condition that kicks out the extension. See issues #24317, #37512, #37203.

**Solution:** Workers run in detached tmux sessions (separate process tree). Token is pre-refreshed to prevent mid-batch refresh races.

## Prerequisites

- `tmux` installed (`brew install tmux`)
- `claude-batch` script in PATH (bundled in `scripts/claude-batch`)

## Your task

Help the user set up and run a parallel batch job. Ask for:

1. Where are the prompt files? (directory path)
2. How many parallel workers? (default: 10, max: 15)
3. Which model? (default: sonnet)
4. Where to put results? (default: prompts_dir_results/)

Then run:

```bash
claude-batch batch -f <prompts_dir> -p <parallel> -m <model> -o <output_dir>
```

Before starting, run `claude-batch check` to verify token health. If token < 2h, the tool will auto-refresh.

After completion, report OK/FAIL/SKIP counts and verify extension auth is intact.
