---
description: Select Codex model
allowed-tools: [
  "codex_get_config",
  "codex_set_config",
  "AskUserQuestion"
]
---

## Your task

Select the default Codex model using interactive UI.

1. Call `codex_get_config` to get the current model setting
2. Use **AskUserQuestion** to present model options:
   - Header: "Model"
   - Question: "Select Codex model"
   - Options (mark current model with "(current)"):
     - `gpt-5.2-codex` - Default, balanced
     - `gpt-5.2` - General purpose
     - `gpt-5.1-codex-max` - Complex tasks
     - `gpt-5.1-codex-mini` - Quick responses
   - multiSelect: false
3. Call `codex_set_config` with key="model" and value=selected model name (remove "(current)" suffix if present)
4. Confirm: "Model set to: {model}"
