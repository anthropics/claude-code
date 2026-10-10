---
description: Assign the current project to an expected account profile
argument-hint: <profile-name>
allowed-tools: ["Bash(node:*)"]
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/profile-manager.mjs" assign "$ARGUMENTS"`. Ensure `.claude/account-profile.local.json` is ignored locally before suggesting it is safe from version control.
