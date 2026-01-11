---
description: Select Codex model
argument-hint: model name (optional)
allowed-tools: [
  "codex_get_config",
  "codex_set_config",
  "codex_models"
]
---

## Your task

Manage the default Codex model.

If no argument provided:
1. Call `codex_get_config` to get current config
2. Show current default model and list available models

If model name provided:
1. Call `codex_set_config` with key="model" and value=the model name
2. Confirm the change

Available models:
- gpt-5.2-codex (default)
- gpt-5.2
- gpt-5.1-codex-max
- gpt-5.1-codex-mini
