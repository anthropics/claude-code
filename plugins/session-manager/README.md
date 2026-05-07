# Sessions Plugin

Manage Claude Code sessions stored on your local machine. List, inspect, and delete sessions that accumulate over time.

## Why?

Claude Code stores every conversation as session files locally. Over time these accumulate and there's no built-in way to clean them up. This plugin adds that capability.

## Commands

### `/sessions:list [--all | search term]`

List sessions for the **current project** by default. Pass `--all` to see sessions across all projects.

Shows:
- Session title and ID
- Start date
- Disk usage
- Orphan status (sessions with conversation data but no metadata)

### `/sessions:delete [session-id | search term | --all]`

Delete one or more sessions from the **current project**. Pass `--all` to operate across all projects.

Supports:
- Deleting by session ID (UUID)
- Searching by title
- Interactive selection from a numbered list
- Bulk deletion

Always asks for confirmation before deleting. Will not delete the currently active session.

**Files removed per session:**
- `{config_dir}/projects/{path}/{sessionId}/` (subagent logs directory)
- `{config_dir}/projects/{path}/{sessionId}.jsonl` (conversation data)
- `{config_dir}/sessions/{pid}.json` (metadata)

## Cross-Platform Support

The plugin automatically detects the correct config directory:

| Platform | Config Directory | Notes |
|----------|-----------------|-------|
| macOS | `~/.claude` | Default location |
| Linux | `$XDG_CONFIG_HOME/claude` | Falls back to `~/.claude` |
| Windows | `%APPDATA%\claude` | Falls back to `%LOCALAPPDATA%\claude`, then `~\.claude` |
| Any | `$CLAUDE_CONFIG_DIR` | Override via environment variable (highest priority) |

## Session Storage Layout

```
{config_dir}/
├── sessions/
│   └── {pid}.json              # Session metadata (pid, sessionId, cwd, startedAt)
├── projects/
│   └── {encoded-cwd}/
│       ├── {sessionId}.jsonl   # Full conversation history
│       └── {sessionId}/        # Subagent logs (tied to session)
│           └── subagents/
│               └── agent-*.jsonl
└── history.jsonl               # All user prompts across sessions
```

## Installation

Launch Claude Code with the plugin directory:

```bash
claude --plugin-dir /path/to/plugins/session-manager
```

Or to always have it available, add a shell alias:

```bash
alias claude='claude --plugin-dir /path/to/plugins/session-manager'
```
