---
description: Select Codex model and reasoning effort
allowed-tools: Bash, AskUserQuestion, Read, Write
---

## Your task

Interactively select an OpenAI Codex model and configure reasoning effort.

### Step 1: Query Available Models

First, get the list of available models from Codex CLI:

```bash
codex models 2>&1
```

Parse the output to extract model names (look for lines containing model identifiers).

### Step 2: Present Model Selection

Use **AskUserQuestion** to let user choose the model:

```json
{
  "questions": [{
    "question": "Which OpenAI Codex model would you like to use?",
    "header": "Model",
    "options": [
      {"label": "gpt-5.2 (Latest)", "description": "GPT-5.2 - Most capable reasoning model"},
      {"label": "o3", "description": "OpenAI o3 - Advanced reasoning"},
      {"label": "gpt-4.1", "description": "GPT-4.1 - Balanced performance"},
      {"label": "gpt-4o", "description": "GPT-4o - Optimized for speed"},
      {"label": "gpt-4o-mini", "description": "GPT-4o Mini - Fast and economical"}
    ],
    "multiSelect": false
  }]
}
```

Extract the selected model name (e.g., "gpt-5.2" from "gpt-5.2 (Latest)").

### Step 3: Query Reasoning Effort Options

Check if the selected model supports reasoning effort configuration:

```bash
codex --model <selected_model> --help 2>&1 | grep -i "effort\|reasoning"
```

Or check model capabilities. Models like o3, gpt-5.2 typically support reasoning effort levels.

### Step 4: Present Reasoning Effort Selection

If model supports reasoning effort, use **AskUserQuestion**:

```json
{
  "questions": [{
    "question": "Select reasoning effort for {model}:",
    "header": "Effort",
    "options": [
      {"label": "Low", "description": "Faster responses, less thorough reasoning"},
      {"label": "Medium (Recommended)", "description": "Balanced speed and reasoning depth"},
      {"label": "High", "description": "Deep reasoning, slower but more accurate"},
      {"label": "Maximum", "description": "Exhaustive reasoning for complex problems"}
    ],
    "multiSelect": false
  }]
}
```

Map user selection to Codex CLI flags:
- Low → `--reasoning-effort low`
- Medium → `--reasoning-effort medium` (or default)
- High → `--reasoning-effort high`
- Maximum → `--reasoning-effort max`

### Step 5: Save Configuration

Update the Codex configuration file:

```bash
# Check if config file exists
if [ -f ~/.codex/config.toml ]; then
  # Backup existing config
  cp ~/.codex/config.toml ~/.codex/config.toml.bak
fi

# Update model setting
# Use sed or manual edit to update config
# For simplicity, you can append/overwrite:

cat > ~/.codex/config.toml <<EOF
model = "<selected_model>"
reasoning_effort = "<selected_effort>"
provider = "openai"
EOF
```

Or use `codex config set` if available:

```bash
codex config set model <selected_model>
codex config set reasoning_effort <selected_effort>
```

### Step 6: Confirm Configuration

Display confirmation to user:

```
## Model Configuration Updated

✓ Model: {selected_model}
✓ Reasoning Effort: {selected_effort}

Configuration saved to: ~/.codex/config.toml

Usage:
  /codex "your query"                    # Uses configured model
  /codex --model gpt-4o "quick query"   # Override for single query
```

### Important Notes

- **Reasoning effort** is only available for certain models (o3, gpt-5.2, etc.)
- Higher reasoning effort = slower responses but better quality
- Configuration persists across sessions
- You can override model per-query with `--model` flag
