---
description: Remove Codex authentication credentials
allowed-tools: Bash
---

## Your task

Remove stored Codex authentication credentials.

### Step 1: Check Current Status

First, verify current authentication status:

```bash
codex login status 2>&1
```

### Step 2: Logout

Execute logout command:

```bash
codex logout
```

This will:
- Remove credentials from `~/.codex/auth.json`
- Clear any cached tokens
- Invalidate the current session

### Step 3: Verify Logout

Confirm credentials are removed:

```bash
codex login status 2>&1
```

Should show "Not logged in"

### Output Format

Display to user:
```
## Codex Logout

{If was logged in:}
✓ Successfully logged out from Codex
Credentials removed from: ~/.codex/auth.json

To use Codex again, run: /codex:login

{If not logged in:}
You are not currently logged in to Codex.
```

### Important Notes

- Logout does not affect existing Codex sessions in `~/.codex/threads/`
- Session history is preserved and can be resumed after re-authentication
- To manage sessions, use `/codex:sessions` command
