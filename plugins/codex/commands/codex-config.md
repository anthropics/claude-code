---
description: Configure OpenAI Codex authentication
allowed-tools: [
  "mcp__codex__codex_status",
  "mcp__codex__codex_login",
  "mcp__codex__codex_models"
]
---

## Your task

Configure OpenAI Codex authentication. You MUST follow these steps exactly:

1. First, call the `codex_status` tool to check authentication status
2. If the result shows "not_authenticated":
   - Explain what OAuth authentication means
   - Call the `codex_login` tool to start the authentication flow
   - A browser will open for OpenAI login
   - The user should complete the login in their browser
3. After authentication (or if already authenticated), call `codex_models` to list available models
4. Display the final status and available models to the user

You have the capability to call multiple tools in a single response. Do not send any text besides these instructions and the tool calls needed to complete this task.
