---
description: Manage Codex sessions
argument-hint: [action]
allowed-tools: Bash, AskUserQuestion
---

## Your task

Manage Codex session history using the CLI.

### CLI Path
```
${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py
```

### Step 1: Determine Action

**If argument provided** ("list" or "clear"):

- Execute that action directly

**If no argument:**

Use **AskUserQuestion** to let user choose:

```json
{
  "questions": [{
    "question": "What would you like to do with Codex sessions?",
    "header": "Action",
    "options": [
      {"label": "List Sessions", "description": "View recent session history with prompts and timestamps"},
      {"label": "Clear All Sessions", "description": "Delete all session history (cannot be undone)"}
    ],
    "multiSelect": false
  }]
}
```

### Step 2: Execute Action

**For "List Sessions":**

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" sessions
```

Display sessions in a clear format:

```
## Recent Codex Sessions

| ID | First Prompt | Messages | Last Active |
|----|--------------|----------|-------------|
| abc123 | "How do I implement..." | 4 | 2 hours ago |
| def456 | "Review this code..." | 2 | yesterday |
```

**For "Clear All Sessions":**

1. Use **AskUserQuestion** for confirmation:

```json
{
  "questions": [{
    "question": "Are you sure you want to clear all session history?",
    "header": "Confirm",
    "options": [
      {"label": "Yes, clear all", "description": "Delete all sessions permanently"},
      {"label": "Cancel", "description": "Keep sessions"}
    ],
    "multiSelect": false
  }]
}
```

2. If confirmed:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" clear-sessions
```

3. Confirm: "All session history cleared."
