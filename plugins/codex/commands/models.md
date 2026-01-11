---
description: List available Codex models
allowed-tools: [
  "mcp__codex__codex_models"
]
---

## Your task

List all available OpenAI Codex models.

1. Call `codex_models` to get the list of models and current default
2. Display the models with the current default marked

### Display Format

```
## Available Codex Models

| Model | Description |
|-------|-------------|
| gpt-5.2-codex | Default, balanced performance |
| gpt-5.2 | General purpose |
| gpt-5.1-codex-max | Best for complex tasks |
| gpt-5.1-codex-mini | Fastest, for quick responses |

Current default: {default_model}
```

### Note

Use `/codex:model` to change the default model.
