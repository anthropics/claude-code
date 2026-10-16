---
description: "Cancel active Ralph Wiggum loop"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/state/*:*)"]
hide-from-slash-command-tool: "true"
---

# Cancel Ralph

To cancel the Ralph loop:

1. Check if a state file exists for this session using Bash:
   ```bash
   RALPH_STATE_FILE="${CLAUDE_PLUGIN_ROOT}/state/${CLAUDE_SESSION_ID}.md"
   test -f "$RALPH_STATE_FILE" && echo "EXISTS" || echo "NOT_FOUND"
   ```

2. **If NOT_FOUND**: Say "No active Ralph loop found for this session."

3. **If EXISTS**:
   - Read the state file to get the current iteration number from the `iteration:` field
   - Remove the file using Bash: `rm "$RALPH_STATE_FILE"`
   - Report: "Cancelled Ralph loop (was at iteration N)" where N is the iteration value
