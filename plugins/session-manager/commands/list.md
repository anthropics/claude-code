---
description: List all sessions across projects with timestamps, previews, and file sizes
allowed-tools: Bash(ls:*), Bash(head:*), Bash(wc:*), Bash(stat:*), Bash(du:*), Bash(cat:*), Bash(find:*)
argument-hint: [project-filter]
---

<!--
COMMAND: list
VERSION: 1.0.0

PURPOSE:
Show a clear overview of all Claude Code sessions, organized by project.
Provides what claude --resume lacks: cross-project visibility, file sizes,
and session metadata at a glance.

USAGE:
  /list                List sessions across all projects
  /list <filter>       Filter to projects matching the keyword

ARGUMENTS:
  project-filter: Optional. Keyword to filter project directories.
-->

# List Sessions

You are helping the user see an overview of their Claude Code sessions.

## Step 1: Discover projects

The session storage root is `~/.claude/projects/`. List all project directories:

```bash
ls ~/.claude/projects/
```

If the user provided an argument (`$ARGUMENTS`), filter to directories containing that keyword (case-insensitive).

## Step 2: Gather session data

For each project directory, list all `.jsonl` session files sorted by modification time (newest first):

```bash
ls -lt ~/.claude/projects/<project-dir>/*.jsonl 2>/dev/null
```

For each session file, extract:
- **File modification time** — last activity timestamp
- **File size** — indicates session length
- **First user message** — from the first `"type":"user"` line, truncated to 60 chars
- **Session ID** — UUID from the filename (show first 8 chars)

## Step 3: Present results

Format the output as a clean, scannable table grouped by project:

```
myproject (3 sessions)
  #  Date        Size    First prompt                                      ID
  1  2026-02-15  245 KB  Fix the auth bug in login flow...                 abc12345
  2  2026-02-14   89 KB  Add dark mode support to the dashboard...         def67890
  3  2026-02-10   12 KB  Quick question about TypeScript generics...       ghi24680

other-project (1 session)
  #  Date        Size    First prompt                                      ID
  1  2026-02-12  530 KB  Implement the new payment processing pipeline...  jkl13579

Total: 4 sessions across 2 projects (876 KB)
```

## Step 4: Suggest actions

After listing, remind the user they can:
- `/session-manager:delete <id>` to remove a specific session
- `/session-manager:cleanup` to bulk-remove old or small sessions

## Important

- Show newest sessions first within each project
- If a project has many sessions (>10), show only the 10 most recent and note how many are hidden
- Use human-readable file sizes (KB, MB)
- Handle empty projects gracefully — skip them silently
- Truncate long project paths for readability but keep them identifiable
