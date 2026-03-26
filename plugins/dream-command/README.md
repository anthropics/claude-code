# Dream Command Plugin

Manual trigger for memory consolidation — the `/dream` command that Claude Code's `/memory` UI references but was never shipped as a built-in command.

## Overview

Claude Code has an `autoDreamEnabled` setting that performs background memory consolidation between sessions. The `/memory` settings panel shows a hint — "/dream to run" — but the `/dream` slash command was never registered, causing an "Unknown skill: dream" error when users try to invoke it.

This plugin provides the missing `/dream` command.

## What it does

When you run `/dream`, Claude performs a reflective pass over your project's memory files:

1. Reads the current `MEMORY.md` index
2. Reviews recent session context for insights worth keeping
3. Creates, updates, or removes memory files as needed
4. Deduplicates overlapping memories
5. Updates the `MEMORY.md` index
6. Reports a summary of changes

### What gets saved

- **User memories** — role, preferences, expertise level
- **Feedback memories** — corrections and confirmations about how to approach work
- **Project memories** — ongoing work, goals, decisions, deadlines
- **Reference memories** — pointers to external systems (dashboards, issue trackers, docs)

### What does NOT get saved

- Code patterns or architecture (derivable from the codebase)
- Git history (use `git log` / `git blame`)
- Debugging solutions (the fix is in the code)
- Anything already in CLAUDE.md files
- Ephemeral task details

## Usage

```
/dream
```

Run at the end of a productive session to consolidate what was learned, or periodically to keep memories organized and deduplicated.

## Relationship to auto-dream

| Feature | Trigger | When |
|---------|---------|------|
| Auto-dream | Automatic | Between sessions (background) |
| `/dream` | Manual | Any time during a session |

Both use the same memory consolidation approach. `/dream` gives you explicit control — useful when you want to ensure specific insights are captured before ending a session.

## Configuration

Enable auto-dream (optional, independent of this plugin):

```json
// ~/.claude/settings.json
{
  "autoDreamEnabled": true
}
```

The `/dream` command works regardless of the `autoDreamEnabled` setting.

## Installation

Install via the Claude Code plugin system:

```
/install-plugin dream-command
```

Or enable it in your settings:

```json
// ~/.claude/settings.json
{
  "enabledPlugins": {
    "dream-command@claude-plugins-official": true
  }
}
```

## Related issues

- [#39135](https://github.com/anthropics/claude-code/issues/39135) — `/dream` returns "Unknown skill: dream"
- [#38461](https://github.com/anthropics/claude-code/issues/38461) — `/dream` command not found

## Author

Anthropic (support@anthropic.com)

## Version

1.0.0
