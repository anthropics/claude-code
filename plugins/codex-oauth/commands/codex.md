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

Execute these steps to send a query to OpenAI Codex:

## Step 1: Verify Authentication

Call the `codex_status` MCP tool to check if you are currently authenticated with OpenAI.

Interpret the result:
- If authenticated: Proceed to Step 2
- If not authenticated: Tell the user to run `/codex-oauth:codex-config` to set up authentication, then stop

## Step 2: Send Query to Codex

Call the `codex_query` MCP tool with:
- `prompt`: The user's question/request
- `model`: Use default (gpt-5.2-codex) unless user specifies otherwise
- Optional: `system_prompt`, `temperature` if needed for specialized behavior

Available models:
- `gpt-5.2-codex` (default) - Best for general coding tasks
- `gpt-5.2` - General purpose model
- `gpt-5.1-codex-max` - Maximum capability
- `gpt-5.1-codex-mini` - Faster, lighter model

## Step 3: Present Response

Display the Codex response clearly to the user.

## Your Task

1. Check authentication with `codex_status`
2. If authenticated, send the user's query to Codex using `codex_query`
3. Display the response
4. If not authenticated, tell user to run `/codex-oauth:codex-config` first
