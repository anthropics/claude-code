---
description: Remove a disposable Claude Code account profile after confirmation
argument-hint: <profile-name>
allowed-tools: ["Bash(node:*)"]
---

Explain that removal permanently deletes the selected profile's local settings and sessions but does not revoke OAuth access. Ask for explicit confirmation, then and only then run `node "${CLAUDE_PLUGIN_ROOT}/scripts/profile-manager.mjs" remove "$ARGUMENTS" --confirm`. Never remove the active profile.
