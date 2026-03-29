---
allowed-tools: Bash(ls:*), Bash(stat:*)
description: List available Claude Code sessions for the current working directory
---

## Context

- Current working directory: !`pwd`
- Available sessions: !`bash -c 'dir=$(pwd | sed "s|/|-|g" | sed "s|^-||"); session_dir="$HOME/.claude/projects/$dir"; if [ -d "$session_dir" ]; then ls "$session_dir"/*.jsonl 2>/dev/null | while read f; do id=$(basename "$f" .jsonl); modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$f" 2>/dev/null || stat --format="%y" "$f" 2>/dev/null | cut -d. -f1); echo "  $id  (last modified: $modified)"; done; else echo "No sessions found for this directory."; fi'`

## Your task

Display the list of available Claude Code sessions for the current working directory shown above.

For each session, show:
1. The session ID
2. The last modified time

Then inform the user they can resume any session with:
```
claude --resume <session-id>
```

If no sessions are found, let the user know there are no saved sessions for this directory.

Do not use any other tools or do anything beyond displaying this information.
