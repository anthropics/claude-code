---
description: Send a query to OpenAI Codex
argument-hint: your question
allowed-tools: [
  "codex_query",
  "codex_status",
  "codex_list_sessions",
  "codex_get_config",
  "AskUserQuestion"
]
---

## Your task

Send a query to OpenAI Codex with intelligent session management.

### Step 1: Check Authentication

Call `codex_status` to verify authentication. If not authenticated, tell user to run `/codex:config` and stop.

### Step 2: Check for Existing Sessions

Call `codex_list_sessions` to see recent sessions. Look for a session that matches the current topic.

### Step 3: Determine Session Strategy

**If continuing an existing session** (follow-up question, same topic):
- Use the matching session_id from Step 2
- Skip to Step 5

**If starting a new session** (new topic, no matching session):
- Proceed to Step 4

### Step 4: Initialize New Session (new sessions only)

Use **AskUserQuestion** to gather context:

1. First, ask about session purpose:
   - Header: "Session"
   - Question: "What is this Codex session for?"
   - Options: Code Generation, Code Review, Debugging, Learning

2. Then, ask about permission level:
   - Header: "Permission"
   - Question: "What permission level should Codex have?"
   - Options:
     - Suggest (Recommended) - Codex suggests, you confirm
     - Auto-Edit - Codex can edit files automatically
     - Full-Auto - Codex has full control

### Step 5: Execute Query

Call `codex_query` with:
- `prompt`: The user's question
- `session_id`: From Step 2 (if continuing) or null (if new)

### Step 6: Display Response

Show the response in this format:

```
{response content}

---
Session: {session_id} | Messages: {message_count}
```

Keep the main response clean - the session info is just a footer reference.
