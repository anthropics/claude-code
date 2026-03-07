---
description: Bulk-remove old or tiny sessions across all projects
allowed-tools: Bash(ls:*), Bash(head:*), Bash(wc:*), Bash(stat:*), Bash(du:*), Bash(cat:*), Bash(find:*), Bash(rm:*), Bash(rmdir:*), Bash(date:*)
argument-hint: [--older-than=30d] [--smaller-than=5KB] [--dry-run]
---

<!--
COMMAND: cleanup
VERSION: 1.0.0

PURPOSE:
Bulk cleanup of stale sessions that clutter the session history.
Targets sessions by age, size, or both. Always shows a preview
before deleting anything.

USAGE:
  /cleanup                            Interactive: suggest sessions to clean up
  /cleanup --older-than=30d           Target sessions older than 30 days
  /cleanup --smaller-than=5KB         Target sessions under 5 KB (likely abandoned)
  /cleanup --older-than=7d --dry-run  Preview what would be deleted without deleting

ARGUMENTS:
  --older-than=<duration>:  Target sessions not modified in this period (e.g., 7d, 2w, 1m)
  --smaller-than=<size>:    Target sessions under this file size (e.g., 5KB, 1MB)
  --dry-run:                Show what would be deleted without actually deleting
-->

# Cleanup Sessions

You are helping the user bulk-clean their Claude Code session history.

## Step 1: Parse arguments

Read the user's arguments (`$ARGUMENTS`) and determine the cleanup criteria:

- `--older-than=<duration>`: Convert to days. Supported units: `d` (days), `w` (weeks), `m` (months, 30 days each).
- `--smaller-than=<size>`: Convert to bytes. Supported units: `KB`, `MB`.
- `--dry-run`: If present, only preview — do not delete.

If no arguments are provided, default to suggesting sessions older than 30 days or smaller than 5 KB.

## Step 2: Scan all sessions

Walk through every project in `~/.claude/projects/` and find session files matching the criteria:

```bash
find ~/.claude/projects/ -name "*.jsonl" -type f
```

For each file, check:
- **Modification time** — compare against `--older-than` threshold
- **File size** — compare against `--smaller-than` threshold

Extract a preview (first user message) for each matching session.

## Step 3: Present candidates

Show the sessions that would be deleted, grouped by project:

```
Sessions matching cleanup criteria (older than 30 days):

myproject
  - [2025-12-01]   3 KB  "Quick test of the API..."             (abc12345)
  - [2025-11-15]   1 KB  "Hello, can you help me with..."       (def67890)

old-project
  - [2025-10-20]  45 KB  "Implement caching layer..."           (ghi24680)

3 sessions, 49 KB total
```

If `--dry-run` is set, stop here and report:
```
Dry run complete. 3 sessions (49 KB) would be deleted. Run without --dry-run to proceed.
```

## Step 4: Confirm and delete

**CRITICAL: Always ask for confirmation before bulk deletion.**

```
Delete these 3 sessions (49 KB)? This cannot be undone.
```

Wait for explicit confirmation. Once confirmed, delete each session's JSONL file and companion directory:

```bash
rm <file>.jsonl
rm -rf <file-without-extension>/
```

Report results:
```
Cleaned up 3 sessions (49 KB freed) across 2 projects.
```

## Important

- **Never delete without showing the full list first and getting confirmation**
- Skip the currently active session — never delete it during cleanup
- Show a summary even if zero sessions match the criteria
- Handle filesystem errors gracefully (permissions, missing files)
- If all sessions in a project directory would be deleted, note this explicitly
