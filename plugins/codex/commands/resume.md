---
description: Resume a previous Codex session
argument-hint: [session_id] or --last
allowed-tools: [
  "mcp__codex__codex_list_sessions",
  "mcp__codex__codex_query",
  "mcp__codex__codex_status",
  "AskUserQuestion"
]
---

## Your task

Resume a previous Codex conversation session.

### Behavior Based on Arguments

**No argument provided:**
1. Call `codex_list_sessions` to get recent sessions
2. Use **AskUserQuestion** to let user pick a session:
   - Header: "Session"
   - Question: "Which session would you like to resume?"
   - Options: Show session ID + first prompt preview for each
3. Resume the selected session

**`--last` argument:**
1. Call `codex_list_sessions` with limit=1
2. Resume the most recent session automatically

**Session ID provided:**
1. Resume the specified session directly

### Resume Process

Once session is selected:
1. Inform user: "Resuming session {session_id}..."
2. Ask user for their follow-up question
3. Call `codex_query` with the session_id and user's prompt
4. Return the response

### Display Format

When listing sessions for selection:
```
Recent Sessions:
1. abc123 - "How do I implement auth..." (2 hours ago)
2. def456 - "Review this function..." (yesterday)
3. ghi789 - "Explain the architecture..." (2 days ago)
```

### Notes

- Sessions preserve conversation context
- Useful for continuing complex multi-turn discussions
- Session data stored in `.claude/codex_config.json`
