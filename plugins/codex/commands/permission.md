---
description: Configure Codex approval mode
allowed-tools: [
  "codex_get_config",
  "codex_set_config",
  "AskUserQuestion"
]
---

## Your task

Configure the Codex approval mode using interactive UI.

1. Call `codex_get_config` to get the current approval mode
2. Use **AskUserQuestion** to present mode options:
   - Header: "Permission"
   - Question: "Select approval mode"
   - Options (mark current mode with "(current)"):
     - `suggest` - Codex suggests, user confirms
     - `auto-edit` - Codex can edit files automatically
     - `full-auto` - Codex has full control
   - multiSelect: false
3. Call `codex_set_config` with key="approval_mode" and value=selected mode (remove "(current)" suffix if present)
4. Confirm: "Approval mode set to: {mode}"
