---
description: Authenticate with OpenAI Codex via ChatGPT OAuth
allowed-tools: Bash
---

## Your task

Authenticate with OpenAI Codex using ChatGPT OAuth.

### Step 1: Check Current Auth Status

First, check if already authenticated:

```bash
codex login status 2>&1
```

If output shows "Logged in", inform user they're already authenticated.

### Step 2: Initiate OAuth Login

If not authenticated, start the OAuth flow:

```bash
codex login
```

This will:
1. Start a local HTTP server
2. Open the default browser
3. Navigate to ChatGPT OAuth page
4. Wait for user to complete authentication

### Step 3: Verify Login Success

After the browser flow completes, verify:

```bash
codex login status
```

### Alternative: Device Code Auth

For headless environments or if browser fails, suggest:

```bash
codex login --device-auth
```

This shows a code and URL for manual authentication.

### Alternative: API Key Login

If user prefers API key authentication:

```bash
echo $OPENAI_API_KEY | codex login --with-api-key
```

### Output Format

Display to user:
```
## Codex Authentication

Status: {authenticated/not authenticated}

{If not authenticated:}
Opening browser for ChatGPT OAuth authentication...
Please complete the login in your browser.

{If authenticated:}
✓ Successfully authenticated with Codex
Credentials stored in: ~/.codex/auth.json

You can now use /codex commands to interact with Codex.
```

### Important Notes

- OAuth credentials are stored securely at `~/.codex/auth.json`
- Default method is ChatGPT OAuth (recommended)
- Device code auth is useful for SSH/remote sessions
- API key auth requires setting OPENAI_API_KEY environment variable
