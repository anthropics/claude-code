---
allowed-tools: Bash(python3:*)
description: Reset your buddy customizations (keeps base buddy)
---

## Your task

The user wants to reset their buddy customizations. **Ask for confirmation first** — this will reset their custom name, personality, stats, and achievements.

If they confirm, run:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/data/buddy_cli.py reset
```

If they don't confirm, tell them the reset was cancelled.
