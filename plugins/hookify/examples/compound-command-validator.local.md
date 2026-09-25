---
name: compound-command-validator
enabled: true
event: bash
action: warn
conditions:
  - field: command
    operator: is_compound
    pattern: ""
---

⚠️ **Compound Command Detected**

This command contains multiple operations chained together. Here's what will execute:

{{COMMAND_BREAKDOWN}}

Each command will run in sequence. Make sure you understand all parts before approving.

**Tip:** Consider running commands one at a time for better control and visibility.
