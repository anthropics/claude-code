---
description: Checkpoint the current session — summarise what we're working on and write it to disk
allowed-tools: Bash(python3:*), Bash(mkdir:*)
---

Current session ID:
!`echo "${CLAUDE_PERSIST_SESSION_ID:-unknown}"`

Do the following:

1. Write a concise summary (2-3 sentences) of what we have been working on in this session: the goal, progress made, and what remains.
2. Identify the single most recent user task or goal in one sentence.
3. Use python3 to write `.claude/sessions/<session-id>.json` (create the directory if needed) with these fields:
   - `session_id` — the ID printed above
   - `saved_at` — current UTC timestamp in ISO 8601 format
   - `last_task` — one-sentence description of the most recent task
   - `summary` — the 2-3 sentence summary you wrote

Confirm with the session ID when done.
