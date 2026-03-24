# Session Rename Plugin

Rename Claude Code sessions for easier identification when using `/resume`.

## Problem

Claude Code sessions are auto-named based on date and context (e.g., "Mar 24 – Analyst meta"), but there is no way to rename them. When working on multiple tasks, sessions accumulate with generic names, making it hard to find past conversations.

See [#38173](https://github.com/anthropics/claude-code/issues/38173) for the full feature request.

## Commands

### `/rename <new-name>`

Renames the current session by creating a `.meta.json` sidecar file alongside the session's `.jsonl` file.

**Usage:**
```
/rename Fix authentication bug
/rename Sprint 47 planning
/rename
```

If called without arguments, prompts for a name interactively.

## How It Works

1. Locates the current session's `.jsonl` file in `~/.claude/projects/{encodedPath}/`
2. Creates or updates a `{sessionId}.meta.json` file with the structure:
   ```json
   {
     "title": "User-provided session name",
     "renamed_at": "2026-03-24T09:00:00Z",
     "auto_title": null
   }
   ```
3. The `.jsonl` file is never modified — the metadata file is a non-breaking sidecar

## Integration Path

This plugin establishes a `.meta.json` convention that the core CLI can adopt to:
- Display custom titles in `/resume` session picker
- Show renamed sessions in the session list UI
- Preserve backward compatibility (fall back to auto-generated title when no `.meta.json` exists)

## Installation

Add to your project's `.claude/settings.json`:
```json
{
  "plugins": ["session-rename"]
}
```

Or install from the plugins directory in this repository.
