---
description: Select Codex model and reasoning effort
allowed-tools: [
  "mcp__codex__codex_list_models",
  "mcp__codex__codex_set_config",
  "AskUserQuestion"
]
---

## Your task

Select the default Codex model and reasoning effort using interactive selection UI.

### Step 1: Fetch Available Models (MUST DO FIRST)

Call `codex_list_models` to get:

- List of available models with their details
- Supported reasoning efforts for each model
- Current model setting

### Step 2: Present Model Selection UI

Use **AskUserQuestion** to let user select a model:

Build options from the models returned by `codex_list_models`:

- Use `display_name` as the label
- Use `description` for the description
- Mark current model with "(current)" suffix
- Only show models where `visibility` is "list"

Example:

```json
{
  "questions": [{
    "question": "Select Codex model",
    "header": "Model",
    "options": [
      {"label": "GPT-5.2 Codex (current)", "description": "Balanced performance for coding tasks"},
      {"label": "GPT-5.2", "description": "General purpose model"},
      {"label": "GPT-5.1 Codex Max", "description": "Best for complex multi-step tasks"},
      {"label": "GPT-5.1 Codex Mini", "description": "Fastest responses"}
    ],
    "multiSelect": false
  }]
}
```

### Step 3: Present Reasoning Effort Selection

After model is selected, look up that model's `supported_reasoning_efforts` from the data in Step 1.

Use **AskUserQuestion** to let user select reasoning effort:

```json
{
  "questions": [{
    "question": "Select reasoning effort for this model",
    "header": "Thinking",
    "options": [
      {"label": "Medium (default)", "description": "Balanced thinking time"},
      {"label": "Low", "description": "Quick responses, less thinking"},
      {"label": "High", "description": "More thorough analysis"},
      {"label": "XHigh", "description": "Maximum thinking, best for complex problems"}
    ],
    "multiSelect": false
  }]
}
```

**Important:**

- Only show reasoning efforts that are in the model's `supported_reasoning_efforts`
- Use the `description` from each reasoning effort preset
- Mark the model's `default_reasoning_effort` with "(default)" suffix

### Step 4: Apply Selection

1. Extract the model ID from selection
2. Extract the reasoning effort from selection (remove "(default)" if present)
3. Call `codex_set_config` with:
   - key: "model"
   - value: selected model ID
4. Call `codex_set_config` with:
   - key: "reasoning_effort"
   - value: selected reasoning effort (lowercase)
5. Confirm: "Model set to: {model} with {reasoning_effort} reasoning"
