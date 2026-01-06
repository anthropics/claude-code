---
description: "Cancel active Ralph Wiggum loop"
allowed-tools: ["Bash(test -f .claude/ralph-loop.local.md:*)", "Bash(rm .claude/ralph-loop.local.md)", "Bash(powershell -Command \"Test-Path .claude/ralph-loop.local.md\")", "Bash(powershell -Command \"Remove-Item .claude/ralph-loop.local.md -Force\")", "Read(.claude/ralph-loop.local.md)"]
---

# Cancel Ralph

To cancel the Ralph loop:

**On Unix/macOS:**

1. Check if `.claude/ralph-loop.local.md` exists: `test -f .claude/ralph-loop.local.md && echo "EXISTS" || echo "NOT_FOUND"`

2. **If NOT_FOUND**: Say "No active Ralph loop found."

3. **If EXISTS**:
   - Read `.claude/ralph-loop.local.md` to get the current iteration number
   - Remove the file: `rm .claude/ralph-loop.local.md`
   - Report: "Cancelled Ralph loop (was at iteration N)"

**On Windows:**

1. Check if exists: `powershell -Command "if (Test-Path .claude/ralph-loop.local.md) { 'EXISTS' } else { 'NOT_FOUND' }"`

2. **If NOT_FOUND**: Say "No active Ralph loop found."

3. **If EXISTS**:
   - Read `.claude/ralph-loop.local.md` to get the current iteration number
   - Remove: `powershell -Command "Remove-Item .claude/ralph-loop.local.md -Force"`
   - Report: "Cancelled Ralph loop (was at iteration N)"
