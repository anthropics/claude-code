---
description: List available Codex models
allowed-tools: Bash
---

## Your task

List all available OpenAI Codex models using the CLI.

### CLI Path
```
${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py
```

### Execution

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" models --fetch
```

### JSON Response Format

```json
{
  "success": true,
  "models": [
    {"id": "gpt-5.2-codex", "display_name": "GPT-5.2 Codex"},
    {"id": "gpt-5.2", "display_name": "GPT-5.2"},
    {"id": "gpt-5.1-codex-max", "display_name": "GPT-5.1 Codex Max"},
    {"id": "gpt-5.1-codex-mini", "display_name": "GPT-5.1 Codex Mini"}
  ],
  "current_model": "gpt-5.2-codex",
  "source": "api"
}
```

### Display Format

```
## Available Codex Models

| Model | Description |
|-------|-------------|
| gpt-5.2-codex (current) | Default, balanced performance |
| gpt-5.2 | General purpose |
| gpt-5.1-codex-max | Best for complex tasks |
| gpt-5.1-codex-mini | Fastest, for quick responses |

Current default: {current_model}
```

### Note

Use `/codex:model` to change the default model.
