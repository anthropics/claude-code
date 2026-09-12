---
allowed-tools: Read, Glob, Bash(rm:*), Bash(rm -r:*)
description: Delete Claude Code sessions for the current project
argument-hint: "[session-id, search term, or --all]"
---

## Context

You are helping the user delete Claude Code sessions stored on their local machine. By default, only show and delete sessions for the **current project directory**. If the user passes `--all` as part of `$ARGUMENTS`, operate across all projects.

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

Convert the current working directory to the encoded path format. For example:
- CWD: `/Users/jane/projects/my-app`
- Encoded: `-Users-jane-projects-my-app`
- JSONL location: `{config_dir}/projects/-Users-jane-projects-my-app/*.jsonl`

## Steps

### Step 1: Find sessions

**IMPORTANT**: Session JSONL files are UUID-named files directly under the project directory (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890.jsonl`). There are also `subagents/` subdirectories containing agent log files — **ignore those**. Use a UUID glob pattern to match only session files:

Use **Glob** to find session JSONL files:
- **Project-scoped** (default): `{config_dir}/projects/{encoded-cwd}/????????-????-????-????-????????????.jsonl`
- **All projects** (if `--all` in arguments): `{config_dir}/projects/*/????????-????-????-????-????????????.jsonl`

Then use **Read** to get the title from the first few lines of each JSONL (look for `"type": "custom-title"`).

Also use **Glob** and **Read** on `{config_dir}/sessions/*.json` to find matching metadata files.

### Step 2: Identify which session(s) to delete

If the user provided `$ARGUMENTS` (besides `--all`):
- If it looks like a UUID, match it against session IDs
- If it's a number, treat it as a selection from the list
- Otherwise, search session titles for the term

If no specific session was identified, present a numbered list and ask the user which session(s) they want to delete. Support:
- A single number (e.g., "3")
- Multiple numbers (e.g., "1, 3, 5")
- "all" to delete all listed sessions
- A search term to filter

### Step 3: Confirm before deleting

**IMPORTANT**: Before deleting, clearly show the user:
- Session ID
- Session title (if available)
- Start date
- Files that will be deleted (full paths)

Ask for explicit confirmation. Do NOT delete without the user saying yes.

**Do not delete the current session.** You can identify the current session because its session ID matches the one in the most recent metadata file for the current working directory.

### Step 4: Delete the session files

For each confirmed session, delete these in order:
1. The subagents directory (if it exists): `rm -r {config_dir}/projects/{encoded-path}/{sessionId}/` — this contains subagent log files tied to the session
2. The conversation JSONL: `rm {config_dir}/projects/{encoded-path}/{sessionId}.jsonl`
3. The matching metadata file (if any): `rm {config_dir}/sessions/{pid}.json` — find the right one by reading each metadata JSON and matching the `sessionId` field

Delete one item at a time. Only use `rm -r` on the `{sessionId}/` subagents directory — never on anything else.

### Step 5: Summary

Report:
- How many sessions were deleted
- Which files were removed
- Any errors encountered

### Important notes

- Use **Read** and **Glob** for discovery. Only use **Bash** for the actual `rm` deletion step.
- Read multiple files in parallel when possible for speed.
- Never delete the currently active session.
- Never use `rm -rf` or wildcards — only delete specific named files.
