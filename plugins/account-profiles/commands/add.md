---
description: Create an isolated Claude Code account profile
argument-hint: <profile-name>
allowed-tools: ["Bash(node:*)"]
---

Create an account profile named `$ARGUMENTS` by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/profile-manager.mjs" add "$ARGUMENTS"
```

Report the generated launch command. Explain that the user authenticates once with `/login` in the newly launched process. Never read, copy, or display credential files.
