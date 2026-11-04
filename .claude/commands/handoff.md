---
allowed-tools: Write, Read
description: Create a handoff summary of current task and progress
---

Create a concise handoff document summarizing the current conversation for error recovery or session continuation.

## Output Format

Write to `~/.claude-handoffs/handoff.md` with this structure:

```markdown
# Handoff Summary
**Created:** [current date/time]
**Project:** [current working directory]

## User's Goal
[What the user wanted to accomplish - the original request/task]

## Current Status
[Where we are in the task - completed, in progress, blocked]

## What Was Done
[Key actions taken, files modified, commands run]

## What Remains
[Any incomplete items or next steps]

## Key Context
[Important details needed to continue - file paths, decisions made, etc.]
```

## Instructions

1. Analyze the conversation history
2. Extract the user's original goal/request
3. Summarize progress and current state
4. Note any important context needed to continue
5. Write the handoff file
6. Confirm to the user with the file path

Keep it concise - focus on what someone needs to continue the work, not a full transcript.
