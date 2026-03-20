#!/bin/bash
# agent-aware-bash-validator.sh
# =============================================================================
# Example PreToolUse hook: Agent-Aware Bash Validator
# =============================================================================
# Demonstrates how to use the `agent_id` and `agent_type`
# fields to write targeted denial messages.
#
# Problem this solves (Issue #36270 / #6885):
#   When a hook denies a Bash call and redirects to an MCP resource, the
#   instructions differ between the main agent and a subagent:
#     - Main agent   → call ReadMcpResourceTool directly
#     - Subagent     → use the resource-read wrapper tool instead
#   Without is_subagent, hooks had to include both instructions, which is noisy.
#
# Hook configuration in hooks/hooks.json or .claude/settings.json:
# {
#   "PreToolUse": [
#     {
#       "matcher": "Bash",
#       "hooks": [
#         {
#           "type": "command",
#           "command": "bash /path/to/agent-aware-bash-validator.sh"
#         }
#       ]
#     }
#   ]
# }
# =============================================================================

set -euo pipefail

# Read hook input from stdin
input=$(cat)

# ── Tool filter ──────────────────────────────────────────────────────────────
tool_name=$(echo "$input" | jq -r '.tool_name // ""')
if [ "$tool_name" != "Bash" ]; then
  exit 0
fi

# ── Extract agent context fields ─────────────────────────────────────────────
agent_id=$(echo "$input" | jq -r '.agent_id // ""')
agent_type=$(echo "$input" | jq -r '.agent_type // ""')

# ── Extract command ───────────────────────────────────────────────────────────
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# ── Policy: block access to internal-policy.sh ───────────────────────────────
if [[ "$command" == *"internal-policy.sh"* ]]; then

  if [ -n "$agent_id" ]; then
    # Subagents cannot call ReadMcpResourceTool — use the wrapper instead
    context_info="[Subagent: '${agent_type:-unknown}']"
    echo "${context_info} Access denied: 'internal-policy.sh' is restricted." >&2
    echo "Use the resource-read wrapper tool:" >&2
    echo "  resource-read(uri='policy://internal-policy')" >&2
  else
    # Main agent has direct MCP access
    echo "Access denied: 'internal-policy.sh' is restricted." >&2
    echo "Read the policy directly via:" >&2
    echo "  ReadMcpResourceTool(uri='policy://internal-policy')" >&2
  fi

  # Exit code 2 → blocks the tool call and feeds stderr back to Claude
  exit 2
fi

# ── Policy: main agent must not run git push directly ────────────────────────
if [ -z "$agent_id" ] && echo "$command" | grep -q "^git push"; then
  echo "Direct 'git push' is not permitted from the main agent." >&2
  echo "Delegate to the @git-expert subagent to perform git operations." >&2
  exit 2
fi

# Allow all other commands
exit 0
