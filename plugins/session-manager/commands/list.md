---
allowed-tools: Read, Glob
description: List Claude Code sessions for the current project
argument-hint: "[--all to show all projects]"
---

## Context

You are listing Claude Code sessions stored on the user's local machine. By default, only show sessions for the **current project directory**. If the user passes `--all` as `$ARGUMENTS`, show sessions across all projects.

### How to find the config directory

The Claude Code config directory varies by platform:
- **Override**: `$CLAUDE_CONFIG_DIR` (if set)
- **macOS**: `~/.claude`
- **Linux**: `$XDG_CONFIG_HOME/claude` (fallback: `~/.claude`)
- **Windows**: `%APPDATA%\claude` (fallback: `%LOCALAPPDATA%\claude`, then `~\.claude`)

### How sessions are stored

1. **Session metadata**: `{config_dir}/sessions/{pid}.json` — contains `pid`, `sessionId`, `cwd`, `startedAt`
2. **Session conversation data**: `{config_dir}/projects/{encoded-path}/{sessionId}.jsonl` — the actual conversation log. The `{encoded-path}` is the working directory with `/` replaced by `-` and a leading `-` (e.g., `/Users/me/project` becomes `-Users-me-project`).
3. **Session history**: `{config_dir}/history.jsonl` — contains all user prompts with their `sessionId`

### How to scope to current project

Convert the current working directory to the encoded path format used in `{config_dir}/projects/`. For example:
- CWD: `/Users/jane/projects/my-app`
- Encoded: `-Users-jane-projects-my-app`
- JSONL location: `{config_dir}/projects/-Users-jane-projects-my-app/*.jsonl`

## Steps

### Step 1: Determine the config directory

Use the platform detection logic above. For most users this will be `~/.claude`.

### Step 2: Find session JSONL files

**IMPORTANT**: Session JSONL files are UUID-named files directly under the project directory (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890.jsonl`). There are also `subagents/` subdirectories containing agent log files — **ignore those**. Use a UUID glob pattern to match only session files:

Use the **Glob** tool to find session files:
- **Project-scoped** (default): Glob for `{config_dir}/projects/{encoded-cwd}/????????-????-????-????-????????????.jsonl`
- **All projects** (if `$ARGUMENTS` contains `--all`): Glob for `{config_dir}/projects/*/????????-????-????-????-????????????.jsonl`

This UUID pattern ensures subagent files in nested directories are excluded.

### Step 3: Read session details

For each JSONL file found:
1. Use **Read** to read the first 5 lines of each JSONL file to find the `custom-title` entry (it's typically the first line with `"type": "custom-title"`)
2. Note the file size from the Glob results or by reading the file

Also use **Glob** to find `{config_dir}/sessions/*.json`, then **Read** each one to get metadata (`sessionId`, `cwd`, `startedAt`). Match these to the JSONL files by `sessionId`.

JSONL files that have no matching metadata JSON are **orphaned sessions** — mark them as `[orphan]`.

### Step 4: Display results

Present a clean numbered list:

```
Sessions for /Users/jane/projects/my-app:

1. Add authentication flow
   ID:      a1b2c3d4-e5f6-7890-abcd-ef1234567890
   Started: 2026-03-13 14:53
   Size:    678.0 KB

2. (no title) [orphan]
   ID:      f9e8d7c6-b5a4-3210-fedc-ba0987654321
   Started: 2026-03-10 09:00
   Size:    12.5 KB

Found 2 session(s): 1 active, 1 orphaned (total: 690.5 KB)
```

If `$ARGUMENTS` contains a search term (not `--all`), filter sessions by matching the term against title, session ID, or directory.

### Important notes

- Use **only** the Read and Glob tools. Do NOT use Bash.
- Read multiple files in parallel when possible for speed.
- Do not include the currently active session's ID in the output — note it as "(current session)" instead.
