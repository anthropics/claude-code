---
name: prevent-windows-bash-silent-exit
enabled: true
event: bash
action: warn
conditions:
  - field: command
    operator: regex_match
    pattern: .*\s*&&.*&&.*
---

⚠️ **High-risk bash command pattern detected on Windows**

This command contains multiple `&&` operations which may cause 
silent PowerShell host exits during long-running agent sessions.

**Issue #55424**: PowerShell silently exits during dense bash subprocess chains.

**To prevent crashes:**
- Break complex chains into separate commands
- Use PowerShell directly for Windows-specific operations  
- Consider restarting session after many bash commands
- Upgrade to v2.1.126+ for Windows PowerShell improvements

**Critical pattern**: `cd <path> && python script.py 2>&1 | grep "..."`

See: https://github.com/anthropics/claude-code/issues/55424
