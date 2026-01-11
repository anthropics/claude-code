---
description: Send a query to OpenAI Codex
argument-hint: your question
allowed-tools: [
  "mcp__plugin_codex_oauth_codex__codex_query",
  "mcp__plugin_codex_oauth_codex__codex_status",
  "mcp__plugin_codex_oauth_codex__codex_login"
]
---

# OpenAI Codex Query

Send questions and requests to OpenAI Codex for AI-powered assistance.

## Process

1. First check authentication status using `codex_status`
2. If not authenticated, inform user and suggest running `/codex-config` to login
3. If authenticated, send the query using `codex_query` with the user's question
4. Present the response clearly to the user

## Notes

- Codex is powered by OpenAI's models (GPT-5.2-codex, etc.)
- It works best for coding questions, code generation, and technical explanations
- You can specify a model in the query if needed (default: gpt-5.2-codex)

## Available Models

- gpt-5.2-codex (default) - Best for general coding tasks
- gpt-5.2 - General purpose model
- gpt-5.1-codex-max - Maximum capability
- gpt-5.1-codex-mini - Faster, lighter model
