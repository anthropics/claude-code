---
description: Configure OpenAI Codex authentication
allowed-tools: [
  "mcp__codex__codex_status",
  "mcp__codex__codex_login",
  "mcp__codex__codex_set_api_key",
  "mcp__codex__codex_clear",
  "AskUserQuestion"
]
---

## Your task

Configure OpenAI Codex authentication.

### Step 1: Check Current Status (MUST DO FIRST)

Call `codex_status` to check current authentication state.

### Step 2: Handle Based on Status

**If already authenticated:**

Use **AskUserQuestion** to show status and ask what to do:

```json
{
  "questions": [{
    "question": "You're already authenticated. What would you like to do?",
    "header": "Config",
    "options": [
      {"label": "Keep Current", "description": "Keep current authentication"},
      {"label": "Switch Method", "description": "Change authentication method"},
      {"label": "Re-authenticate", "description": "Log out and authenticate again"}
    ],
    "multiSelect": false
  }]
}
```

- If "Keep Current" → Show status and finish
- If "Switch Method" or "Re-authenticate" → Continue to Step 3

**If not authenticated:**

Continue directly to Step 3.

### Step 3: Select Authentication Method

Use **AskUserQuestion** to let user choose:

```json
{
  "questions": [{
    "question": "How would you like to authenticate with OpenAI Codex?",
    "header": "Auth",
    "options": [
      {"label": "ChatGPT Subscription (Recommended)", "description": "Sign in with Plus/Pro/Team/Enterprise via browser OAuth"},
      {"label": "API Key", "description": "Enter your OpenAI API key (sk-...) for usage-based billing"}
    ],
    "multiSelect": false
  }]
}
```

### Step 4: Execute Authentication

**If "ChatGPT Subscription":**

1. If switching, call `codex_clear` first
2. Call `codex_login` to start OAuth browser flow
3. Call `codex_status` to verify success
4. Confirm: "Authenticated with ChatGPT subscription!"

**If "API Key":**

1. If switching, call `codex_clear` first
2. Ask user to provide their API key (or use "Other" input if provided)
3. Call `codex_set_api_key` with the key
4. Call `codex_status` to verify success
5. Confirm: "API key configured successfully!"
