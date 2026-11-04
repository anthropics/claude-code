# Agent Status Plugin

Check background subagent status by auditing their JSONL transcript logs.
Type `/agent-status` to see all agents with timestamps and recent log activity.

## What it does

When you run background subagents (via the Agent tool with `run_in_background`),
their activity is logged to JSONL transcript files on disk. This plugin reads
those files and shows you a status table:

```
====== Agent Status | Session: d4e48215 | last activity: 8s ago ======

[1] a6b61b4 | Explore
    "Thoroughly explore the Claude Code repository..."
    01:41:55 → 01:45:44 (3m 49s) | 54 tools

    01:45:12  Bash     cat .../plugins/hookify/.claude-plugin/plugin.json
    01:45:13  Bash     cat .../plugins/agent-sdk-dev/.claude-plugin/plugin.json
    01:45:13  result   {"name": "hookify", "version": "0.1.0", "description"...
    01:45:13  result   {"name": "agent-sdk-dev", "description": "Claude Agent...
    01:45:44  text     "Excellent! Now I have all the information I need..."

=================== 1 agents ====================
```

For each agent you see:
- **Agent ID** and type
- **Prompt preview** (what it was asked to do)
- **Time range** (start → last log timestamp) and duration
- **Tool count** (total tool calls made)
- **Last N log lines** with timestamps (default 5)

Compare the last timestamp to current time to judge if an agent is still
active or stuck.

## How it works

1. A **SessionStart hook** captures the current session ID and saves it to
   `~/.claude/agent-status/current-session.json`
2. The `/agent-status` command runs a Python script that:
   - Reads the session ID from the hook marker file
   - Finds the subagent JSONL files at
     `~/.claude/projects/<project>/<session>/subagents/`
   - Parses each file using `head` (prompt), `tail` (recent log), and
     `grep` (tool count) — never reads the full file
   - Prints the formatted status table

## Usage

```
/agent-status           Show last 5 log lines per agent (default)
/agent-status -n 10     Show last 10 log lines per agent
/agent-status -n 1      Show last 1 log line per agent (minimal)
```

## Installation

Install via the Claude Code plugin system, or copy the `agent-status/` directory
to `~/.claude/plugins/`.

Once installed, the SessionStart hook activates automatically. No additional
configuration needed.

## Files

```
agent-status/
  .claude-plugin/plugin.json       Plugin metadata
  commands/agent-status.md          /agent-status slash command
  hooks/hooks.json                  SessionStart hook registration
  hooks/on_session_start.sh         Saves session ID on session start
  scripts/agent-status.py           Core parser script
```
