#!/bin/bash
# Example PreToolUse hook for validating Write/Edit operations
# This script demonstrates file write validation patterns

set -euo pipefail

# Read input from stdin
input=$(cat)

# Extract file path and content
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

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

# Validate path exists
if [ -z "$file_path" ]; then
  exit 0
fi

# Check for path traversal
if [[ "$file_path" == *".."* ]]; then
  respond "deny" "Path traversal detected in: $file_path"
fi

# Check for system directories
if [[ "$file_path" == /etc/* ]] || [[ "$file_path" == /sys/* ]] || [[ "$file_path" == /usr/* ]]; then
  respond "deny" "Cannot write to system directory: $file_path"
fi

# Check for sensitive files
if [[ "$file_path" == *.env ]] || [[ "$file_path" == *secret* ]] || [[ "$file_path" == *credentials* ]]; then
  respond "ask" "Writing to potentially sensitive file: $file_path"
fi

# Approve the operation
exit 0
