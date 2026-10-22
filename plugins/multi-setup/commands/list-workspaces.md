---
description: "List all parallel development workspaces created by /multi-setup"
argument-hint: ""
allowed-tools: ["Bash(cat:*)", "Bash(ls:*)"]
---

# List Workspaces

Read `.claude/multi-setup-workspaces.local.md` in the current project and display a formatted table of all workspaces.

```!
if [ -f .claude/multi-setup-workspaces.local.md ]; then
  cat .claude/multi-setup-workspaces.local.md
else
  echo "No workspaces found. Run /multi-setup to create one."
fi
```

Parse and present the workspaces in a readable format: name, path, branch, config mode, and created date.
