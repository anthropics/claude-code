---
description: Send a query to OpenAI Codex
argument-hint: your question
allowed-tools: [
  "mcp__plugin_codex_oauth_codex__codex_query",
  "mcp__plugin_codex_oauth_codex__codex_status",
  "mcp__plugin_codex_oauth_codex__codex_login"
]
---

## Your task

Send a query to OpenAI Codex. You MUST follow these steps exactly:

1. First, call the `codex_status` tool to check if you are authenticated
2. If not authenticated, tell the user to run `/codex-config` first and stop
3. If authenticated, call the `codex_query` tool with the user's question as the prompt
4. Display the response from Codex to the user

Available Codex models (use default gpt-5.2-codex unless user specifies):
- gpt-5.2-codex (default)
- gpt-5.2
- gpt-5.1-codex-max
- gpt-5.1-codex-mini

You have the capability to call multiple tools in a single response. Only perform the task steps above; do not send any other text.
