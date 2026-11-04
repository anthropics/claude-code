---
description: Configure the enhanced status line for this Claude Code session
---

# Setup Enhanced Status Line

Configure Claude Code to use the enhanced status line that displays:

- 📁 Current directory
- ⎇ Git branch with status (* for uncommitted, ↑N for unpushed)
- ◉ Context usage with percentage and token count
- ⏱ Session duration
- +/-Lines code changes
- 💰 Session cost

The status line script is located at: `${CLAUDE_PLUGIN_ROOT}/scripts/statusline.sh`

To apply this configuration, update your settings with:

```json
{
  "statusLine": {
    "type": "command",
    "command": "${CLAUDE_PLUGIN_ROOT}/scripts/statusline.sh",
    "padding": 0
  }
}
```

Would you like me to add this configuration to your settings now?
