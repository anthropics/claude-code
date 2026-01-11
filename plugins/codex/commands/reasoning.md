---
description: Select Codex reasoning effort level
allowed-tools: [
  "mcp__codex__codex_list_models",
  "mcp__codex__codex_get_config",
  "mcp__codex__codex_set_config",
  "AskUserQuestion"
]
---

## Your task

Select the default reasoning effort level for the current model.

### Step 1: Get Current Configuration

Call `codex_get_config` to get the current model and reasoning effort.

### Step 2: Fetch Model's Supported Reasoning Levels

Call `codex_list_models` to get the supported reasoning efforts for the current model.

Look up the current model in the results and get its `supported_reasoning_efforts` array.

### Step 3: Present Reasoning Effort Selection

Use **AskUserQuestion** to let user select reasoning effort:

Build options from the model's `supported_reasoning_efforts`:

- Use the `effort` value as the base label
- Use the `description` from each preset
- Mark the current reasoning effort with "(current)" suffix

Example:

```json
{
  "questions": [{
    "question": "Select reasoning effort for {model_name}",
    "header": "Thinking",
    "options": [
      {"label": "Medium (current)", "description": "Balanced thinking time"},
      {"label": "Low", "description": "Quick responses, less thinking"},
      {"label": "High", "description": "More thorough analysis"},
      {"label": "XHigh", "description": "Maximum thinking, best for complex problems"}
    ],
    "multiSelect": false
  }]
}
```

### Step 4: Apply Selection

1. Extract the reasoning effort from selection (remove "(current)" if present)
2. Call `codex_set_config` with:
   - key: "reasoning_effort"
   - value: selected effort level (lowercase)
3. Confirm: "Reasoning effort set to: {effort}"
