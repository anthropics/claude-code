---
description: Configure Codex approval mode
argument-hint: mode (optional)
allowed-tools: [
  "codex_get_config",
  "codex_set_config"
]
---

## Your task

Manage the Codex approval mode.

If no argument provided:
1. Call `codex_get_config` to get current config
2. Show current approval mode and explain available modes

If mode provided:
1. Call `codex_set_config` with key="approval_mode" and value=the mode
2. Confirm the change

Available modes:
- suggest: Codex suggests, user confirms (default)
- auto-edit: Codex can edit files automatically
- full-auto: Codex has full control
