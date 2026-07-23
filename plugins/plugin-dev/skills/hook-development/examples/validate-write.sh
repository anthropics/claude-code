#!/bin/bash
# Example PreToolUse hook for validating Write/Edit operations
# This script demonstrates file write validation patterns

set -euo pipefail

# Read input from stdin
input=$(cat)

# Extract file path and content
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Validate path exists
if [ -z "$file_path" ]; then
  echo '{"continue": true}' # No path to validate
  exit 0
fi

# Check for path traversal
if [[ "$file_path" == *".."* ]]; then
  jq -n --arg p "$file_path" '{"hookSpecificOutput": {"permissionDecision": "deny"}, "systemMessage": ("Path traversal detected in: " + $p)}'
  exit 2
fi

# Check for system directories
if [[ "$file_path" == /etc/* ]] || [[ "$file_path" == /sys/* ]] || [[ "$file_path" == /usr/* ]]; then
  jq -n --arg p "$file_path" '{"hookSpecificOutput": {"permissionDecision": "deny"}, "systemMessage": ("Cannot write to system directory: " + $p)}'
  exit 2
fi

# Check for sensitive files
if [[ "$file_path" == *.env ]] || [[ "$file_path" == *secret* ]] || [[ "$file_path" == *credentials* ]]; then
  jq -n --arg p "$file_path" '{"hookSpecificOutput": {"permissionDecision": "ask"}, "systemMessage": ("Writing to potentially sensitive file: " + $p)}'
  exit 2
fi

# Approve the operation
exit 0
