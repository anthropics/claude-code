# Session Manager Plugin

List and resume Claude Code sessions for the current working directory.

## Overview

Claude Code saves conversation sessions per project directory under `~/.claude/projects/`. This plugin provides a simple `/sessions` command to discover and display all saved sessions for your current working directory, making it easy to pick up where you left off.

## Commands

### `/sessions`

Lists all available Claude Code sessions for the current working directory.

**What it does:**
1. Resolves the current working directory to its Claude project path
2. Lists all saved session files (`.jsonl`) for that directory
3. Displays each session ID with its last-modified timestamp
4. Shows the command to resume any session

**Usage:**
```bash
/sessions
```

**Example output:**
```
Available Claude Code sessions for /Users/you/my-project:

  56d1e406-31c0-4589-b7ae-a35965d9692b  (last modified: 2026-03-29 14:22)
  f86b6356-c5bf-467c-b05f-5cb34c48e354  (last modified: 2026-03-28 09:11)

To resume a session, run:
  claude --resume <session-id>
```

**Features:**
- Scoped to the current working directory — only shows sessions relevant to your project
- Displays last-modified timestamps so you can identify the most recent session
- Works on macOS and Linux

## Installation

This plugin is included in the Claude Code repository. To use it in your own project, install it via the `/plugin` command or configure it in `.claude/settings.json`.

## Requirements

- Claude Code installed
- Sessions are stored at `~/.claude/projects/<encoded-path>/`

## Author

Abdul Sahil (abdulsaheel81@gmail.com)

## Version

1.0.0
