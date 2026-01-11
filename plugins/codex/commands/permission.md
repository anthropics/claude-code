---
description: Configure Codex approval mode
allowed-tools: [
  "mcp__codex__codex_get_config",
  "mcp__codex__codex_set_config",
  "AskUserQuestion"
]
---

## Your task

Configure the Codex approval mode using interactive selection UI.

### Step 1: Query Current Config (MUST DO FIRST)

Call `codex_get_config` to get:

- Current approval mode setting
- List of available modes (`available_approval_modes` field)

### Step 2: Present Selection UI

Use **AskUserQuestion** with the data from Step 1:

```json
{
  "questions": [{
    "question": "Select approval mode for Codex operations",
    "header": "Permission",
    "options": [
      {"label": "suggest (current)", "description": "Codex suggests changes, you confirm before applying"},
      {"label": "auto-edit", "description": "Codex can edit files automatically, asks for shell commands"},
      {"label": "full-auto", "description": "Codex has full control (use with caution)"}
    ],
    "multiSelect": false
  }]
}
```

**Important:**

- Mark the current mode with "(current)" suffix
- Use the `available_approval_modes` from config for the actual options

### Step 3: Apply Selection

1. Extract the mode name from selection (remove "(current)" if present)
2. Call `codex_set_config` with:
   - key: "approval_mode"
   - value: selected mode name
3. Confirm: "Approval mode set to: {mode}"
