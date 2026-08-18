# Desktop Session Sync Plugin

Bridges CLI session history into the Claude desktop app so conversations started in the CLI appear in the desktop app's conversation list for browsing, searching, and resuming.

## Problem

The Claude Code CLI and the Claude desktop app use independent storage backends:

- **CLI** stores sessions as `.jsonl` transcripts in `~/.claude/projects/`
- **Desktop app** maintains its own session list for the Conversations tab

There is no built-in sync path between them.

## Solution

This plugin provides a **local metadata bridge**: it walks the CLI's session transcripts and creates `local_<uuid>.json` metadata files in the desktop app's session directory. The desktop app's existing session list rendering code picks these files up automatically — no modifications to the desktop app are needed.

### How metadata files work

Each `local_<uuid>.json` file contains:

```json
{
  "title": "First user message or filename",
  "model": "claude-opus-4-7",
  "date": "2026-05-24T06:00:00+00:00",
  "cliSessionId": "project-name/session-uuid.jsonl",
  "platform": "cli",
  "projectDir": "/home/user/.claude/projects/my-project"
}
```

The desktop app renders a row in the session list from this metadata and opens the CLI transcript when clicked.

## Features

- **Manual sync** via `/sync-desktop-sessions` slash command
- **PostToolUse hook** that auto-syncs after transcript writes (when running as a plugin)
- **Standalone usage** — the Python script can be run independently without the plugin system
- **Dry-run mode** — preview what would be synced before writing
- **Cross-platform** — macOS, Windows, and Linux

## Installation

### As a plugin

1. Install the plugin in your project or globally:

```bash
# In your project directory
claude /plugin install desktop-session-sync

# Or symlink from the plugins directory
ln -s /path/to/plugins/desktop-session-sync .claude/plugins/desktop-session-sync
```

2. The hook will auto-sync after each transcript write. Run `/sync-desktop-sessions` for a full sync.

### Standalone script

```bash
python3 plugins/desktop-session-sync/hooks/sync_sessions.py
```

### Run periodically (cron / launch agent)

```bash
# macOS — run every 10 minutes via launchd
# Or add to your shell rc file:
python3 plugins/desktop-session-sync/hooks/sync_sessions.py &

# Linux — add a cron job:
# */10 * * * * python3 /path/to/plugins/desktop-session-sync/hooks/sync_sessions.py
```

## Usage

```bash
# Full sync — walks all CLI transcripts, creates missing desktop metadata
python3 sync_sessions.py

# Dry-run — preview without writing anything
python3 sync_sessions.py --dry-run

# Sync only the most recently active session (used by PostToolUse hook)
python3 sync_sessions.py --sync-current
```

## Limitations

- **One-directional**: CLI → Desktop only. Changes in the desktop app are not reflected back to the CLI.
- **Local only**: Syncs only on the current machine. For multi-device sync, the account-based API approach (Option A in the [feature proposal](/examples/features/cli-desktop-conversation-sync.md)) would be needed.
- **Metadata only**: The full transcript stays in `~/.claude/projects/`; the desktop metadata file is a lightweight pointer.

## Related

- [Feature Proposal: CLI-Desktop Conversation Sync](/examples/features/cli-desktop-conversation-sync.md)
- Issue [#61967](https://github.com/anthropics/claude-code/issues/61967)
- Issue [#56172](https://github.com/anthropics/claude-code/issues/56172)
