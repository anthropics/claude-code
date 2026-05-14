---
description: "Propose Don't Execute — show all planned changes before making them"
---

# Propose Don't Execute (PDE) Mode

For this request, do NOT make any file edits, shell commands, or other side-effecting actions yet. Instead:

1. **Analyze** what needs to be done for: $ARGUMENTS
2. **List every change** you would make — file by file, edit by edit — with enough detail to review:
   - For file edits: show the diff or before/after snippets
   - For new files: show the full content
   - For shell commands: show the exact command and explain what it does
   - For deletions: state what's being removed and why
3. **Wait for approval** before executing anything

Once I say "go", "lgtm", "do it", or similar — execute all proposed changes. If I request modifications, revise the proposal first.
