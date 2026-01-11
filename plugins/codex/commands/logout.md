---
description: Log out from OpenAI Codex
allowed-tools: Bash, AskUserQuestion
---

## Your task

Clear stored Codex credentials (OAuth tokens and API keys).

### CLI Path
```
${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py
```

### Step 1: Check Current Status

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" status
```

Show current authentication state before clearing.

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

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" logout
```

Then verify:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" status
```

Confirm: "Credentials cleared. Run `/codex:login` to re-authenticate."

**If "Cancel":**

Confirm: "Credentials unchanged."

### When to Use

- Switching to a different OpenAI account
- Switching between OAuth and API key authentication
- Troubleshooting authentication issues
- Security concerns (compromised tokens)
