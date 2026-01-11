---
description: Clear stored Codex credentials
allowed-tools: [
  "mcp__codex__codex_clear",
  "mcp__codex__codex_status",
  "AskUserQuestion"
]
---

## Your task

Clear stored Codex credentials (OAuth tokens and API keys).

### Step 1: Check Current Status

Call `codex_status` to show current authentication state before clearing.

### Step 2: Confirm with User

Use **AskUserQuestion** to confirm the action:

```json
{
  "questions": [{
    "question": "Clear all Codex credentials? You will need to re-authenticate.",
    "header": "Confirm",
    "options": [
      {"label": "Yes, clear credentials", "description": "Remove OAuth tokens and API key"},
      {"label": "Cancel", "description": "Keep current credentials"}
    ],
    "multiSelect": false
  }]
}
```

### Step 3: Execute Based on Selection

**If "Yes, clear credentials":**

1. Call `codex_clear` to remove all stored credentials
2. Call `codex_status` to verify credentials are cleared
3. Confirm: "Credentials cleared. Run `/codex:config` to re-authenticate."

**If "Cancel":**

- Confirm: "Credentials unchanged."

### When to Use

- Switching to a different OpenAI account
- Switching between OAuth and API key authentication
- Troubleshooting authentication issues
- Security concerns (compromised tokens)
