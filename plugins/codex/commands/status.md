---
description: Show Codex status, authentication, and sessions
allowed-tools: [
  "mcp__codex__codex_status",
  "mcp__codex__codex_get_config",
  "mcp__codex__codex_list_sessions"
]
---

## Your task

Display comprehensive Codex status information.

### Steps

1. Call `codex_status` to get authentication status
2. Call `codex_get_config` to get configuration
3. Call `codex_list_sessions` to get recent sessions

### Display Format

Present information in a clear, organized format:

```
## Authentication
- Status: {authenticated/not_authenticated}
- Method: {oauth/api_key/none}
- Account: {account_id or API key masked}

## Configuration
- Model: {current model}
- Approval Mode: {current mode}

## Sessions
- Active sessions: {count}
- Recent:
  - {session_id}: {first prompt preview} ({timestamp})
  ...
```

### Notes

- If not authenticated, suggest running `/codex:login`
- If no sessions, indicate "No active sessions"
- For OAuth, show token expiry if available
- For API key, show masked key (sk-***...xxx)
