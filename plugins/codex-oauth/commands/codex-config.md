---
description: Configure OpenAI Codex authentication
allowed-tools: [
  "mcp__plugin_codex_oauth_codex__codex_status",
  "mcp__plugin_codex_oauth_codex__codex_login",
  "mcp__plugin_codex_oauth_codex__codex_models"
]
---

# OpenAI Codex Configuration

Check authentication status and guide setup if needed.

## Process

1. Use `codex_status` to check current authentication status
2. If not authenticated:
   - Explain what OAuth authentication means
   - Use `codex_login` to start the authentication flow
   - The user's browser will open for OpenAI login
   - After successful login, confirm authentication
3. If authenticated:
   - Show current status (token expiry, account ID)
   - Offer option to re-authenticate if needed
4. Optionally show available models using `codex_models`

## Authentication Flow

The plugin uses OAuth 2.0 with PKCE for secure authentication:

1. Browser opens to OpenAI's authorization page
2. User logs in with their OpenAI/ChatGPT account
3. Authorization callback returns to localhost:1455
4. Tokens are stored securely in ~/.claude/auth.json (0600 permissions)
5. Access tokens auto-refresh before expiry

## Requirements

- ChatGPT Pro or Plus subscription for Codex access
- Web browser for OAuth login
- Port 1455 available for OAuth callback
