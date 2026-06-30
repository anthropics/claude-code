---
description: Debug and validate MCP server configurations
---

## Check MCP Config Files

Looking for MCP configuration files in standard locations:

!`ls -la ~/.claude/mcp.json ~/.claude/.mcp.json ./.claude/mcp.json 2>&1 | grep -v "cannot access" || echo "No MCP config files found"`

## Validate JSON Syntax

For each file found above, validate JSON syntax:

!`for f in ~/.claude/mcp.json ~/.claude/.mcp.json ./.claude/mcp.json; do if [ -f "$f" ]; then echo "=== $f ==="; python3 -m json.tool "$f" > /dev/null 2>&1 && echo "✅ Valid JSON" || echo "❌ Invalid JSON"; fi; done`

## Display Merged Config

Show the effective MCP configuration (merge of all files):

!`cat ~/.claude/mcp.json ~/.claude/.mcp.json ./.claude/mcp.json 2>/dev/null | python3 -c "import sys, json; configs=[json.loads(l) for l in sys.stdin if l.strip()]; merged={}; [merged.update(c) for c in configs]; print(json.dumps(merged, indent=2))" 2>&1 || echo "No valid configs to merge"`

## Diagnosis

Based on the output above:
1. If no files found: You need to create `~/.claude/mcp.json`
2. If invalid JSON: Fix syntax errors shown
3. If files exist but `/mcp` doesn't detect them: This is bug #12314 - the config loader may be looking in wrong paths
