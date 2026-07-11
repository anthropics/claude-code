#!/bin/bash
# Example PreToolUse hook for validating Bash commands
# This script demonstrates bash command validation patterns

set -euo pipefail

# Read input from stdin
input=$(cat)

# Extract command
command=$(echo "$input" | jq -r '.tool_input.command // empty')

respond() {
  local decision="$1"
  local reason="$2"
  jq -n --arg decision "$decision" --arg reason "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: $decision,
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

# Validate command exists
if [ -z "$command" ]; then
  exit 0
fi

# Check for obviously safe commands (quick approval)
if [[ "$command" =~ ^(ls|pwd|echo|date|whoami)(\s|$) ]]; then
  exit 0
fi

# Check for destructive operations
if [[ "$command" == *"rm -rf"* ]] || [[ "$command" == *"rm -fr"* ]]; then
  respond "deny" "Dangerous command detected: rm -rf"
fi

# Check for other dangerous commands
if [[ "$command" == *"dd if="* ]] || [[ "$command" == *"mkfs"* ]] || [[ "$command" == *"> /dev/"* ]]; then
  respond "deny" "Dangerous system operation detected"
fi

# Check for privilege escalation
if [[ "$command" == sudo* ]] || [[ "$command" == su* ]]; then
  respond "ask" "Command requires elevated privileges"
fi

# Approve the operation
exit 0
