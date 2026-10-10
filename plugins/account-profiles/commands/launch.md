---
description: Print the command to launch Claude Code with an account profile
argument-hint: <profile-name>
allowed-tools: ["Bash(node:*)"]
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/profile-manager.mjs" launch "$ARGUMENTS"`. Explain that the command must be used in a new terminal because a plugin cannot replace authentication in the running Claude Code process.
