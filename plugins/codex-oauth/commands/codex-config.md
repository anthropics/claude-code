---
description: Configure OpenAI Codex authentication
allowed-tools: [
  "mcp__plugin_codex_oauth_codex__codex_status",
  "mcp__plugin_codex_oauth_codex__codex_login",
  "mcp__plugin_codex_oauth_codex__codex_models"
]
---

# OpenAI Codex Configuration

Execute these steps to configure OpenAI Codex authentication:

## Step 1: Check Authentication Status

Call the `codex_status` MCP tool (from the codex-oauth plugin's codex server) to check if you are currently authenticated with OpenAI.

Interpret the result:
- If status is `authenticated`: Display the authentication details (token expiry, account ID)
- If status is `not_authenticated`: Proceed to Step 2

## Step 2: Authenticate (if needed)

If not authenticated, call the `codex_login` MCP tool to initiate the OAuth 2.0 authentication flow:
- A browser window will automatically open
- User will see OpenAI's authorization page
- User logs in with their OpenAI/ChatGPT account
- Browser redirects back to localhost:1455 with authorization code
- Tokens are securely stored in ~/.claude/auth.json (0600 permissions)
- Tokens auto-refresh before expiry

## Step 3: Display Available Models

Call the `codex_models` MCP tool to list available Codex models and show the default model.

## Summary

Your job is to:
1. Call `codex_status` and show the result
2. If not authenticated, call `codex_login` to start OAuth
3. Call `codex_models` to show available models
4. Report success or any errors that occurred
