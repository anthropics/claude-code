---
description: Manage Codex sessions
argument-hint: list|clear (optional)
allowed-tools: [
  "codex_list_sessions",
  "codex_clear_sessions"
]
---

## Your task

Manage Codex session history.

If no argument or "list":
1. Call `codex_list_sessions` to get recent sessions
2. Display sessions with their prompts and timestamps

If "clear":
1. Ask user to confirm
2. Call `codex_clear_sessions` to clear history
3. Confirm cleared
