---
description: Select Codex model
allowed-tools: [
  "mcp__codex__codex_get_config",
  "mcp__codex__codex_set_config",
  "AskUserQuestion"
]
---

## Your task

Select the default Codex model using interactive selection UI.

### Step 1: Query Current Config (MUST DO FIRST)

Call `codex_get_config` to get:
- Current model setting
- List of available models (`available_models` field)

### Step 2: Present Selection UI

Use **AskUserQuestion** with the data from Step 1:

```json
{
  "questions": [{
    "question": "Select Codex model",
    "header": "Model",
    "options": [
      {"label": "gpt-5.2-codex (current)", "description": "Default, balanced performance"},
      {"label": "gpt-5.2", "description": "General purpose"},
      {"label": "gpt-5.1-codex-max", "description": "Best for complex tasks"},
      {"label": "gpt-5.1-codex-mini", "description": "Fastest, for quick responses"}
    ],
    "multiSelect": false
  }]
}
```

**Important:**
- Mark the current model with "(current)" suffix
- Use the `available_models` from config for the actual options

### Step 3: Apply Selection

1. Extract the model name from selection (remove "(current)" if present)
2. Call `codex_set_config` with:
   - key: "model"
   - value: selected model name
3. Confirm: "Model set to: {model}"
