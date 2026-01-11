---
description: Configure OpenAI Codex authentication
allowed-tools: [
  "mcp__codex__codex_status",
  "mcp__codex__codex_login",
  "mcp__codex__codex_set_api_key",
  "mcp__codex__codex_models",
  "AskUserQuestion"
]
---

## Your task

Configure OpenAI Codex authentication. **You MUST use AskUserQuestion to let the user choose their authentication method BEFORE calling any login tools.**

### Step 1: Check Current Status

First, call `codex_status` to check if already authenticated.

### Step 2: If Not Authenticated - MUST Ask User First

If status shows "not_authenticated", you **MUST** immediately use AskUserQuestion with this EXACT format:

```json
{
  "questions": [{
    "question": "How would you like to authenticate with OpenAI?",
    "header": "Auth",
    "options": [
      {"label": "ChatGPT Subscription (Recommended)", "description": "Sign in with Plus/Pro/Team/Enterprise via browser OAuth"},
      {"label": "API Key", "description": "Enter your OpenAI API key (sk-...) for usage-based billing"}
    ],
    "multiSelect": false
  }]
}
```

**IMPORTANT: Do NOT call codex_login until the user has made their selection!**

### Step 3: Execute Based on User Choice

**If user selected "ChatGPT Subscription":**

- Call `codex_login` to start OAuth flow
- Browser will open for OpenAI login

**If user selected "API Key" or "Other" with an API key:**

- If the user provided their key in "Other", call `codex_set_api_key` with that key
- Otherwise, tell the user to provide their API key (starts with "sk-") and call `codex_set_api_key`

### Step 4: Verify

Call `codex_status` again to confirm authentication succeeded.

---

**Remember: The selection UI MUST appear before any authentication action.**
