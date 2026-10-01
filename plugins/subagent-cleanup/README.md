# Subagent Cleanup Plugin

Automatically terminates orphaned subagent processes at session start, preventing CPU and memory leaks from accumulating across sessions.

## Problem

When using the Agent tool (Explore, Plan, and other subagents), Claude Code spawns child processes via `claude --resume`. These processes are not always cleaned up when:

- The parent session is interrupted or exits unexpectedly
- Sessions are switched without proper shutdown
- Background agents complete but their process lingers

Over time, this leads to dozens or hundreds of orphaned processes consuming significant system resources. On laptops, this can cause thermal throttling within minutes.

**Related issue:** [#47827](https://github.com/anthropics/claude-code/issues/47827)

## How It Works

A `SessionStart` hook runs a Python script that:

1. Lists all running processes
2. Identifies Claude subagent processes (those with `--resume` in their command line)
3. Protects the current session's process chain (walks up the parent PID tree)
4. Sends `SIGTERM` to all orphaned subagents
5. Reports the number of cleaned-up processes to stderr

## Installation

This plugin is part of the Claude Code plugins directory. It is automatically available when using Claude Code.

To install manually:

```bash
claude /plugin install subagent-cleanup
```

Or add to your project's `.claude/settings.json`:

```json
{
  "plugins": ["subagent-cleanup"]
}
```

## Manual Alternative

If you prefer not to use this plugin, you can add a hook directly to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "pkill -f 'claude.*--resume' 2>/dev/null; exit 0"
          }
        ]
      }
    ]
  }
}
```

Note: The manual approach is less precise — it does not protect the current session's process chain and may kill active subagents from a concurrent session.

## Requirements

- Python 3.7+
- No external dependencies (uses stdlib only)
- Works on macOS and Linux

## License

MIT License
