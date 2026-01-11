---
description: Log in to OpenAI Codex
allowed-tools: Bash, AskUserQuestion
---

## Your task

Configure OpenAI Codex authentication using the CLI.

### CLI Path
```
${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py
```

### Step 1: Check Current Status (MUST DO FIRST)

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" status
```

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
      {"label": "API Key (Recommended)", "description": "Enter your OpenAI API key (sk-...) for stable authentication"},
      {"label": "ChatGPT Subscription", "description": "Sign in with Plus/Pro/Team/Enterprise via browser OAuth"}
    ],
    "multiSelect": false
  }]
}
```

### Step 4: Execute Authentication

**If "API Key":**

1. If switching, clear first:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" logout
```

2. Ask user to provide their API key (or use "Other" input if provided)

3. Set the API key:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" set-api-key "sk-..."
```

4. Verify:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" status
```

5. Confirm: "API key configured successfully!"

**If "ChatGPT Subscription":**

1. If switching, clear first:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" logout
```

2. Start OAuth:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" login
```

3. Verify:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" status
```

4. Confirm: "Authenticated with ChatGPT subscription!"
