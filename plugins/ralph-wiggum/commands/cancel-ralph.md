---
description: "Cancel active Ralph Loop"
allowed-tools: ["Bash(ls .claude/ralph-loop-*.local.md:*)", "Bash(rm .claude/ralph-loop-*.local.md)", "Read(.claude/ralph-loop-*.local.md)"]
hide-from-slash-command-tool: "true"
---

# Cancel Ralph

Arguments: $ARGUMENTS

To cancel a Ralph loop:

1. **Parse the --id argument from $ARGUMENTS**:
   - If `--id <name>` is provided, the target file is `.claude/ralph-loop-<name>.local.md`
   - If no `--id` is provided, list all active loops first

2. **If no --id provided**:
   - List all active loops using Bash: `ls .claude/ralph-loop-*.local.md 2>/dev/null || echo "NONE"`
   - If "NONE" or empty: Say "No active Ralph loops found."
   - If one or more loops exist: Show the list and ask user to specify which one to cancel with `--id`

3. **If --id is provided**:
   - Check if `.claude/ralph-loop-<id>.local.md` exists using Bash: `test -f .claude/ralph-loop-<id>.local.md && echo "EXISTS" || echo "NOT_FOUND"`
   - **If NOT_FOUND**: Say "No Ralph loop found with ID '<id>'."
   - **If EXISTS**:
     - Read `.claude/ralph-loop-<id>.local.md` to get the current iteration number from the `iteration:` field
     - Remove the file using Bash: `rm .claude/ralph-loop-<id>.local.md`
     - Report: "Cancelled Ralph loop '<id>' (was at iteration N)" where N is the iteration value

Examples:
- `/cancel-ralph` - List all active loops
- `/cancel-ralph --id my-task` - Cancel the loop with ID "my-task"
