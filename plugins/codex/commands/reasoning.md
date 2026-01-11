---
description: Select Codex reasoning effort level
allowed-tools: Bash, AskUserQuestion
---

## Your task

Select the default reasoning effort level for Codex queries.

### CLI Path
```
${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py
```

### Step 1: Get Current Configuration

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" get-config
```

This shows the current model and reasoning effort.

### Step 2: Present Reasoning Effort Selection

Use **AskUserQuestion** to let user select reasoning effort:

```json
{
  "questions": [{
    "question": "Select reasoning effort level",
    "header": "Thinking",
    "options": [
      {"label": "Medium (Recommended)", "description": "Balanced thinking time"},
      {"label": "None", "description": "No extended thinking"},
      {"label": "Minimal", "description": "Very light thinking"},
      {"label": "Low", "description": "Quick responses"},
      {"label": "High", "description": "More thorough analysis"},
      {"label": "XHigh", "description": "Maximum thinking, best for complex problems"}
    ],
    "multiSelect": false
  }]
}
```

### Step 3: Apply Selection

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" set-reasoning "<effort>"
```

Confirm: "Reasoning effort set to: {effort}"

### Available Levels

| Level | Description |
|-------|-------------|
| none | No extended thinking |
| minimal | Very light thinking |
| low | Quick responses |
| medium | Balanced (default) |
| high | Thorough analysis |
| xhigh | Maximum thinking |
