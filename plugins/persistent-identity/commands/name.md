---
description: View or change your Claude Code instance's name
argument-hint: [new-name]
allowed-tools:
  - Bash
---

Run the rename script with the provided arguments:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/rename-identity.sh" $ARGUMENTS
```

After running:
- If the user provided a name, confirm the rename and note it takes effect next session
- If no name was provided, show them their current identity
