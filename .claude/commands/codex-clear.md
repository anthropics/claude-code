---
description: Clear stored Codex credentials
allowed-tools: [
  "codex_clear",
  "codex_status"
]
---

## Your task

Clear stored Codex credentials. You MUST follow these steps exactly:

1. First, call the `codex_status` tool to check if credentials exist
2. If credentials exist, call the `codex_clear` tool to remove them
3. Verify with another `codex_status` call that credentials are cleared
4. Inform the user that credentials have been cleared and they can re-authenticate with `/codex:config`

You have the capability to call multiple tools in a single response. Only perform the task steps above; do not send any other text.
