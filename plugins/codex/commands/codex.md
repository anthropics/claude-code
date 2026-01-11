---
description: Send a query to OpenAI Codex
argument-hint: your question
allowed-tools: [
  "codex_query",
  "codex_status"
]
---

## Your task

Send a query to OpenAI Codex and display ONLY the response.

1. Call `codex_status` to check authentication
2. If not authenticated, tell user to run `/codex:config` and stop
3. Call `codex_query` with the user's question
4. Display the response text directly - no extra formatting, metadata, or session details

Keep the output clean and simple - just show the answer.
