---
description: Select Codex model and reasoning effort
allowed-tools: Bash, AskUserQuestion
---

## Your task

Select the default Codex model and reasoning effort using interactive selection UI.

### CLI Path
```
${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py
```

### Step 1: Fetch Available Models (MUST DO FIRST)

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" models --fetch
```

This returns:
- List of available models with their details
- Current model setting

### Step 2: Present Model Selection UI

Use **AskUserQuestion** to let user select a model:

Build options from the models returned:

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

Use **AskUserQuestion** to let user select reasoning effort:

```json
{
  "questions": [{
    "question": "Select reasoning effort level",
    "header": "Thinking",
    "options": [
      {"label": "Medium (Recommended)", "description": "Balanced thinking time"},
      {"label": "Low", "description": "Quick responses, less thinking"},
      {"label": "High", "description": "More thorough analysis"},
      {"label": "XHigh", "description": "Maximum thinking, best for complex problems"}
    ],
    "multiSelect": false
  }]
}
```

### Step 4: Apply Selection

1. Set model:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" set-model "<model-id>"
```

2. Set reasoning effort:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" set-reasoning "<effort>"
```

3. Confirm: "Model set to: {model} with {reasoning_effort} reasoning"

### Available Reasoning Efforts

- `none` - No extended thinking
- `minimal` - Very light thinking
- `low` - Quick responses
- `medium` - Balanced (default)
- `high` - Thorough analysis
- `xhigh` - Maximum thinking
