---
description: Send a query to OpenAI Codex
argument-hint: your question
allowed-tools: [
  "mcp__codex__codex_query",
  "mcp__codex__codex_status",
  "mcp__codex__codex_list_sessions"
]
---

## Your task

Send the user's query directly to OpenAI Codex.

### Step 1: Check Authentication

Call `codex_status` to verify authentication. If not authenticated, tell user to run `/codex:login` first.

### Step 2: Check for Session Continuity

Analyze the query to determine if it's a follow-up:

**Continue existing session if:**
- Query references "it", "that", "the code", etc.
- User says "also", "continue", "what about..."
- Same topic as recent session

If continuing, call `codex_list_sessions` to find the relevant session_id.

**Start new session if:**
- Standalone question
- Different topic
- User explicitly says "new question"

### Step 3: Execute Query

Call `codex_query` with:
- prompt: user's question
- session_id: from Step 2 (or omit for new session)

### Step 4: Return Response

Display the Codex response directly. Include session info at the end:

```
{Codex response}

---
Session: {session_id} | Use `/codex:resume {session_id}` to continue
```

### Important

- **DO NOT ask permission questions** for simple queries
- Just execute the query and return the response
- Only use `/codex:permission` if user wants to change approval mode
