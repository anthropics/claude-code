---
description: Manually sync all CLI session transcripts to the Claude desktop app session list
allowed-tools: ["Read", "Bash", "Write"]
---

# Sync CLI Sessions to Desktop App

Manually syncs CLI conversation history from `~/.claude/projects/` into the Claude desktop app's session list so you can browse and resume CLI sessions from the desktop UI.

## Usage

```
/sync-desktop-sessions
```

Run this command to immediately sync all CLI session transcripts to the desktop app. A summary of how many sessions were synced, skipped, or already present will be displayed.

## What it does

1. Walks `~/.claude/projects/` for all `.jsonl` session transcripts
2. Identifies transcripts without a matching metadata entry in the desktop app's session directory
3. Creates `local_<uuid>.json` metadata files in the desktop app's session directory
4. The metadata files reference the original CLI transcript via `cliSessionId`

## Platform paths

| Platform | Desktop session directory |
|----------|-------------------------|
| macOS    | `~/Library/Application Support/Claude/claude-code-sessions/` |
| Windows  | `%APPDATA%\Claude\claude-code-sessions\` |
| Linux    | `~/.config/Claude/claude-code-sessions/` |
