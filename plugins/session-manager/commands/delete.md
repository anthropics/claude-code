---
description: Delete a session by name, ID, or interactively from a list
allowed-tools: Bash(ls:*), Bash(head:*), Bash(rm:*), Bash(wc:*), Bash(stat:*), Bash(cat:*), Bash(rmdir:*)
argument-hint: [session-name-or-id]
---

<!--
COMMAND: delete
VERSION: 1.0.0

PURPOSE:
Permanently delete a Claude Code session and its associated data.
Closes the gap in the session lifecycle: Create > Work > Resume > Clear > Delete.

USAGE:
  /delete              Show numbered list of sessions in current project, pick one to delete
  /delete <name>       Delete session matching name (fuzzy match)
  /delete <uuid>       Delete session matching ID prefix

ARGUMENTS:
  session-name-or-id: Optional. Session name or UUID prefix to target.
                      If omitted, shows an interactive list.
-->

# Delete Session

You are helping the user delete a Claude Code session. Follow these steps carefully.

## Step 1: Locate sessions

The Claude Code session storage root is `~/.claude/projects/`. Each subdirectory maps to a project path (with path separators replaced by `-`).

Determine which project the user is currently in by looking at the current working directory. Encode the path to match the directory naming convention (e.g., `/Users/alice/myproject` becomes `C--Users-alice-myproject` on macOS/Linux, `C--Users-alice-Desktop` on Windows).

List session files in the matching project directory:
```bash
ls -lt ~/.claude/projects/<project-dir>/*.jsonl 2>/dev/null
```

If the user provided an argument (`$ARGUMENTS`), filter to sessions matching that name or UUID prefix.

## Step 2: Show session details

For each candidate session file, extract a preview by reading the first user message:
```bash
head -20 <file> | grep '"type":"user"' | head -1
```

Parse the JSON to extract:
- `timestamp` — when the session started
- `message.content` — the first user prompt (truncate to 80 chars)
- `sessionId` — the UUID

Present a numbered list to the user:
```
Sessions in <project-name>:

  1. [2026-02-15] "Fix the auth bug in login..."  (abc12345)
  2. [2026-02-14] "Add dark mode support..."       (def67890)
  3. [2026-02-13] "Refactor database queries..."   (ghi24680)
```

If only one session matches the argument, skip the list and go directly to Step 3.

## Step 3: Confirm deletion

**CRITICAL: Always ask the user to confirm before deleting.** Show the session preview and ask:

```
Delete session "Fix the auth bug in login..." (abc12345)?
This will permanently remove the session file and any associated data.
```

Wait for explicit user confirmation. Do NOT proceed without it.

## Step 4: Delete the session

Once confirmed, delete:
1. The session JSONL file: `~/.claude/projects/<project-dir>/<uuid>.jsonl`
2. The companion data directory if it exists: `~/.claude/projects/<project-dir>/<uuid>/`

```bash
rm ~/.claude/projects/<project-dir>/<uuid>.jsonl
rm -rf ~/.claude/projects/<project-dir>/<uuid>/
```

Report success:
```
Deleted session <uuid>.
```

## Important

- **Never delete without confirmation** — session data is not recoverable
- If no sessions are found, tell the user and suggest checking `~/.claude/projects/` manually
- Handle edge cases: permission errors, missing files, empty project directories
- If the user asks to delete the currently active session, warn them that this will remove the history of the current conversation
