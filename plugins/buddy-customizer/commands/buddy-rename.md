---
allowed-tools: Bash(python3:*)
description: Rename your coding buddy
---

## Your task

The user wants to rename their coding buddy. Read the argument they provided after the command.

Run this command to rename the buddy, replacing `NEW_NAME` with the name the user provided:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/data/buddy_cli.py rename "NEW_NAME"
```

Then confirm the rename with a short, friendly message. If no name was provided, ask them what name they'd like.
