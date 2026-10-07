---
description: "Cancel active Ralph Wiggum loop"
allowed-tools: ["Bash(ls .claude/ralph-loop.*.local.md:*)", "Bash(rm .claude/ralph-loop.*.local.md)", "Bash(rm .claude/ralph-loop.local.md)", "Read(.claude/*)"]
hide-from-slash-command-tool: "true"
---

# Cancel Ralph

To cancel the Ralph loop:

1. Check for active ralph-loop state files using Bash: `ls .claude/ralph-loop.*.local.md 2>/dev/null || echo "NOT_FOUND"`

2. **If NOT_FOUND**: Also check for legacy file: `ls .claude/ralph-loop.local.md 2>/dev/null || echo "NOT_FOUND"`. If both not found, say "No active Ralph loop found."

3. **If files found**:
   - Read each state file to get the current iteration number from the `iteration:` field
   - If `$CLAUDE_SESSION_ID` is set, prefer removing only the file matching this session: `.claude/ralph-loop.${CLAUDE_SESSION_ID}.local.md`
   - Otherwise, remove all found state files
   - Report: "Cancelled Ralph loop (was at iteration N)" where N is the iteration value
