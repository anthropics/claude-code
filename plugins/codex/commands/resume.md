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

### Step 1: Determine Which Session

**If `--last` argument:**

1. Call `codex_list_sessions` with limit=1
2. Resume the most recent session automatically

**If session_id provided:**

- Use that session directly

**If no argument:**

1. Call `codex_list_sessions` to get recent sessions (MUST DO FIRST)
2. Use **AskUserQuestion** to let user select:

```json
{
  "questions": [{
    "question": "Which session would you like to resume?",
    "header": "Session",
    "options": [
      {"label": "abc123 - How do I implement auth...", "description": "4 messages, 2 hours ago"},
      {"label": "def456 - Review this function...", "description": "2 messages, yesterday"},
      {"label": "ghi789 - Explain the architecture...", "description": "6 messages, 2 days ago"}
    ],
    "multiSelect": false
  }]
}
```

**Important:** Build options dynamically from `codex_list_sessions` results.

### Step 2: Resume Session

1. Extract session_id from user's selection
2. Inform user: "Resuming session {session_id}..."
3. Show brief context of what was discussed

### Step 3: Get Follow-up Query

Wait for user's follow-up question, then call `codex_query` with:

- session_id: the selected session
- prompt: user's question

Return the Codex response.

### Notes

- Sessions preserve full conversation context
- Useful for continuing complex multi-turn discussions
- Session data stored in `.claude/codex_config.json`
