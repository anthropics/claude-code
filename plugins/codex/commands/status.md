---
description: Show Codex status, authentication, and sessions
allowed-tools: Bash
---

## Your task

Display comprehensive Codex status information using the CLI.

### CLI Path
```
${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py
```

### Steps

1. Get status:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" status
```

2. Get sessions:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" sessions
```

### JSON Response Format

```json
{
  "success": true,
  "auth": {
    "authenticated": true,
    "auth_method": "api_key",
    "api_key_masked": "sk-proj-...1234",
    "message": "Using API key: sk-proj-...1234"
  },
  "config": {
    "model": "gpt-5.2-codex",
    "approval_mode": "suggest",
    "reasoning_effort": "medium",
    "session_count": 5
  }
}
```

### Display Format

Present information in a clear, organized format:

```
## Authentication
- Status: {authenticated/not authenticated}
- Method: {oauth/api_key/none}
- Credentials: {masked key or account info}

## Configuration
- Model: {current model}
- Reasoning Effort: {effort level}
- Approval Mode: {current mode}

## Sessions
- Active sessions: {count}
- Recent:
  - {session_id}: {prompt preview} ({timestamp})
  ...
```

### Notes

- If not authenticated, suggest running `/codex:login`
- If no sessions, indicate "No active sessions"
- For API key, show masked key (sk-***...xxx)
