# Agent Session Commit

Capture session learnings to `AGENTS.md` for cross-tool AI interoperability.

## Overview

This plugin helps you build a knowledge base that works across AI coding assistants (Claude Code, Cursor, Windsurf, etc.) by:

- **Prompting at session end** to capture valuable learnings
- **Updating AGENTS.md** with patterns, preferences, and project insights
- **Initializing AGENTS.md** if it doesn't exist (like `/init` but for AGENTS.md)
- **Keeping CLAUDE.md minimal** as a pointer to the authoritative AGENTS.md

## Why AGENTS.md?

`AGENTS.md` is an emerging standard for AI-readable project documentation that works across different AI tools. By consolidating your project knowledge in `AGENTS.md`, you get consistent behavior whether using Claude Code, Cursor, Windsurf, or other AI assistants.

`CLAUDE.md` is kept minimal, pointing to `AGENTS.md` as the single source of truth.

## Features

### Stop Hook (Automatic)

When Claude finishes a task, you'll be asked:

> "Would you like to capture learnings from this session to update your AGENTS.md?"

If you agree, Claude will:
1. Check if AGENTS.md exists (create if missing)
2. Analyze the session for patterns, preferences, decisions
3. Propose specific additions to AGENTS.md
4. Ensure CLAUDE.md exists with pointer content

### `/session-commit` Command (Manual)

Trigger the capture process anytime during a session:

```
/session-commit
```

Use this when you want to save learnings mid-session or before exiting.

## What Gets Captured

- **Coding patterns**: Style preferences, naming conventions
- **Architecture decisions**: Why things are structured a certain way
- **Gotchas**: Pitfalls discovered during development
- **Project conventions**: How this codebase does things
- **Debugging insights**: What to check when things break
- **Workflow preferences**: How you like to work

## Important: Ctrl+C Behavior

**Note:** The Stop hook triggers when Claude decides a task is complete, NOT on Ctrl+C.

- Hard interrupts (Ctrl+C) may bypass the hook entirely
- For guaranteed capture, use `/session-commit` before exiting
- The Stop hook works for normal "task complete" endings

## Installation

The plugin is included in the Claude Code plugins repository. Enable it in your Claude Code settings.

## Configuration

No configuration required. The plugin works out of the box.

To skip the end-of-session prompt, simply decline when asked.
