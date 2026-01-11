---
description: Clear stored Codex credentials
allowed-tools: [
  "codex_clear",
  "codex_status"
]
---

# Clear Codex Credentials

Remove stored OAuth tokens and require re-authentication.

## Process

1. Ask user to confirm they want to clear credentials
2. If confirmed, use `codex_clear` to remove stored tokens
3. Verify with `codex_status` that credentials are cleared
4. Inform user they'll need to run `/codex:config` to re-authenticate

## When to Use

- Switching to a different OpenAI account
- Troubleshooting authentication issues
- Security concerns (compromised tokens)
- Cleaning up before uninstalling the plugin

## Note

This removes tokens from ~/.claude/auth.json. You'll need to complete the OAuth flow again to use Codex.
