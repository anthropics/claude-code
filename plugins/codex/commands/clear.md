---
description: Clear stored Codex credentials
allowed-tools: [
  "mcp__codex__codex_clear",
  "mcp__codex__codex_status"
]
---

# Clear Codex Credentials

Remove stored OAuth tokens and API keys, requiring re-authentication.

## Process

1. Ask user to confirm they want to clear credentials
2. If confirmed, use `codex_clear` to remove stored tokens and API key
3. Verify with `codex_status` that credentials are cleared
4. Inform user they'll need to run `/codex:config` to re-authenticate

## When to Use

- Switching to a different OpenAI account
- Switching between OAuth and API key authentication
- Troubleshooting authentication issues
- Security concerns (compromised tokens)
