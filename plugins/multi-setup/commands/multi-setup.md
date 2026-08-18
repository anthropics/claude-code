---
description: "Create a parallel development workspace — full git clone in a new folder, opened in a new Claude Code session"
argument-hint: "[workspace-name] [--branch BRANCH] [--config copy|symlink]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/create-workspace.sh:*)"]
---

# Multi Setup

Run the workspace creation script:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/create-workspace.sh" $ARGUMENTS
```

Report the output to the user. If the script succeeded, confirm the workspace path and that a new Claude Code session was launched.
