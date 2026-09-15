---
description: Diagnose hookify rules for parse, regex, and naming issues
allowed-tools: ["Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/diagnostics.py doctor:*)"]
---

# Hookify Doctor

Run the official hookify diagnostics script against the current project's `.claude/` directory:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/diagnostics.py doctor --rules-dir .claude`

Summarize the results for the user:
- If no rules are found, say so and point them to `/hookify`
- If issues are found, group them by file and explain the likely fix
- If everything is clean, say the rules look healthy
