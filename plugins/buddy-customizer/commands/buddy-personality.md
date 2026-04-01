---
allowed-tools: Bash(python3:*)
description: Set a custom personality for your buddy
---

## Your task

The user wants to set a custom personality description for their buddy. Read the argument they provided.

Run this command, replacing `PERSONALITY_TEXT` with the user's desired personality:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/data/buddy_cli.py personality "PERSONALITY_TEXT"
```

Then confirm with a short message. If no personality was provided, ask them to describe the personality they want (e.g., "an optimistic octopus who celebrates every passing test").
