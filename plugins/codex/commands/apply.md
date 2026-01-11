---
description: Apply code changes suggested by Codex
argument-hint: [session_id]
allowed-tools: [
  "mcp__codex__codex_list_sessions",
  "mcp__codex__codex_query",
  "Read",
  "Edit",
  "Write",
  "Bash",
  "AskUserQuestion"
]
---

## Your task

Apply code changes from a Codex session response to the codebase.

### Step 1: Select Session

**If session_id argument provided:**

- Use that session directly

**If no argument:**

1. Call `codex_list_sessions` to get recent sessions
2. Use **AskUserQuestion** to let user select:

```json
{
  "questions": [{
    "question": "Which session's changes would you like to apply?",
    "header": "Session",
    "options": [
      {"label": "abc123 - How do I implement...", "description": "4 messages, 2 hours ago"},
      {"label": "def456 - Review this code...", "description": "2 messages, yesterday"},
      {"label": "ghi789 - Explain the arch...", "description": "6 messages, 2 days ago"}
    ],
    "multiSelect": false
  }]
}
```

### Step 2: Get Changes from Codex

Call `codex_query` with the selected session_id and this prompt:

```
Based on our previous conversation, provide the code changes in this exact format:

FILE: path/to/file.ts
ACTION: modify|create|delete
[diff content]

List all files that need changes.
```

### Step 3: Confirm Application

Use **AskUserQuestion** for apply options:

```json
{
  "questions": [{
    "question": "How would you like to apply these changes?",
    "header": "Apply",
    "options": [
      {"label": "Apply All", "description": "Apply all changes at once"},
      {"label": "Review Each", "description": "Confirm each file individually"},
      {"label": "Cancel", "description": "Don't apply any changes"}
    ],
    "multiSelect": false
  }]
}
```

### Step 4: Execute Based on Selection

**If "Apply All":**

- Apply all changes using Edit/Write tools
- Report: "Applied changes to N files."

**If "Review Each":**

- For each file, use **AskUserQuestion**:

```json
{
  "questions": [{
    "question": "Apply changes to src/auth.ts?",
    "header": "File",
    "options": [
      {"label": "Apply", "description": "Apply this change"},
      {"label": "Skip", "description": "Skip this file"},
      {"label": "Cancel All", "description": "Stop applying changes"}
    ],
    "multiSelect": false
  }]
}
```

**If "Cancel":**

- Confirm: "No changes applied."
