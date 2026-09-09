---
name: warn-windows-pipe-pattern
enabled: true
event: bash
action: warn
conditions:
  - field: command
    operator: regex_match
    pattern: .*\s+2>&1\s*\|\s*grep
---

🔧 **Windows pipe pattern detected**

Commands using `2>&1 | grep` patterns may cause handle leaks 
and silent exits on Windows PowerShell hosts.

**Problem**: stderr redirect + pipe operations can overwhelm PowerShell
during long-running agent sessions with many subprocess calls.

**Alternatives:**
- Use PowerShell's native error handling
- Redirect to temporary files instead of pipes
- Break into separate commands when possible

**Issue Reference**: #55424 - PowerShell silent exit during dense bash chains
