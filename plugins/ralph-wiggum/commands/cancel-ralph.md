---
description: "Cancel the Ralph Wiggum loop for the current session"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/cancel-ralph-loop.sh:*)"]
hide-from-slash-command-tool: "true"
---

# Cancel Ralph

Run the session-scoped cancellation script:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/cancel-ralph-loop.sh" --session-id "${CLAUDE_CODE_SESSION_ID}"
```
