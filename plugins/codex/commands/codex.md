---
description: Send a query to OpenAI Codex
argument-hint: your question
allowed-tools: [
  "Task"
]
---

## Your task

Route the user's Codex query through the `codex-session` sub-agent for intelligent session management.

**Use the Task tool** to spawn the `codex-session` agent with:
- subagent_type: "codex:codex-session"
- prompt: The user's question/request

The sub-agent will handle:
1. Authentication verification
2. Session continuity (new vs existing)
3. Permission confirmation for new sessions
4. Query execution via MCP
5. Response formatting

Simply pass the user's request to the sub-agent and return its response.
