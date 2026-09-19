# Handover Plugin

Export your current Claude Code session context to a structured handover file — ready to paste into a new Claude session, a different LLM, or hand off to another developer.

## Overview

When you end a session mid-task, switching to a new Claude session means losing context: what you were building, decisions made, what's left to do. `/handover` captures all of that in one command.

It gathers live git state (branch, status, recent commits, diff) and synthesizes the conversation into a structured markdown file. Two output formats:

- **Default (human)** — rich markdown with narrative sections, great for reading or sharing with a teammate
- **`--llm` flag** — compact context block optimized for pasting as an opening message to another AI session

## Commands

### `/handover`

Generate a human-readable session handover file.

**What it produces — `handover-YYYY-MM-DD.md`:**

- Project Context (directory, branch, git status)
- Recent Commits
- What We Were Working On
- Accomplished
- Key Decisions (with rationale)
- Files Touched This Session
- Next Steps (priority ordered)
- Open Questions / Blockers
- Handoff Notes

**Usage:**
```
/handover
```

### `/handover --llm`

Generate a compact handover block optimized for LLM ingestion.

**What it produces — `handover-YYYY-MM-DD-llm.md`:**

A terse, structured context block with task summary, status, decisions, active files, and the single most important next action. Designed to be pasted as an opening message to another AI session.

**Usage:**
```
/handover --llm
```

## Example Workflow

### Ending a session

```
/handover
# → writes handover-2026-06-28.md
# → "Captured: plugin implementation session, 3 files touched, 2 next steps"
```

### Starting the next session

Open a new Claude Code session and paste the contents of `handover-2026-06-28.md` as your first message. Claude immediately has full context.

### Switching to another LLM

```
/handover --llm
# → writes handover-2026-06-28-llm.md
```

Paste the compact block as your system prompt or opening message in ChatGPT, Gemini, or any other tool.

## Requirements

- Works in any directory (git state is included if the directory is a git repo, gracefully skipped if not)
- No external tools required

## Author

Shriyam Shrivastava

## Version

1.0.0
