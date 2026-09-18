---
name: block-dangerous-compound
enabled: false
event: bash
action: block
conditions:
  - field: command
    operator: is_compound
    pattern: ""
  - field: command
    operator: regex_match
    pattern: "rm\s+-rf|del\s+/|format|dd\s+if="
---

❌ **BLOCKED: Dangerous Compound Command**

This compound command includes potentially destructive operations that could cause data loss:

{{COMMAND_BREAKDOWN}}

**Why this is blocked:**
Combining destructive commands with other operations increases the risk of unintended consequences. The command might execute partially, leaving your system in an inconsistent state.

**What to do:**
1. Run the destructive command separately after verifying it's correct
2. Test with safer alternatives first (e.g., `ls` instead of `rm`)
3. Make sure you have backups before proceeding

**Commands detected:** {{BASE_COMMANDS}}
