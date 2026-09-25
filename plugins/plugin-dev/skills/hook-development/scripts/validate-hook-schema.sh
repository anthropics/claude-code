#!/bin/bash
# Hook Schema Validator
# Validates hooks.json structure and checks for common issues

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <path/to/hooks.json>"
  echo ""
  echo "Validates hook configuration file for:"
  echo "  - Valid JSON syntax"
  echo "  - Required fields"
  echo "  - Hook type validity"
  echo "  - Matcher patterns"
  echo "  - Timeout ranges"
  exit 1
fi

HOOKS_FILE="$1"

if [ ! -f "$HOOKS_FILE" ]; then
  echo "Error: File not found: $HOOKS_FILE"
  exit 1
fi

echo "Validating hooks configuration: $HOOKS_FILE"
echo ""

echo "Checking JSON syntax..."
if ! jq empty "$HOOKS_FILE" 2>/dev/null; then
  echo "Invalid JSON syntax"
  exit 1
fi
echo "Valid JSON"

# Plugin hooks.json files use {"description": "...", "hooks": {...}}.
# Settings-style files place events at the root. Support both layouts.
HOOKS_QUERY="."
if jq -e '.hooks and (.hooks | type == "object")' "$HOOKS_FILE" >/dev/null 2>&1; then
  HOOKS_QUERY=".hooks"
fi

echo ""
echo "Checking root structure..."
VALID_EVENTS=("PreToolUse" "PostToolUse" "UserPromptSubmit" "Stop" "SubagentStop" "SessionStart" "SessionEnd" "PreCompact" "Notification")

for event in $(jq -r "$HOOKS_QUERY | keys[]" "$HOOKS_FILE"); do
  found=false
  for valid_event in "${VALID_EVENTS[@]}"; do
    if [ "$event" = "$valid_event" ]; then
      found=true
      break
    fi
  done

  if [ "$found" = false ]; then
    echo "Warning: Unknown event type: $event"
  fi
done
echo "Root structure valid"

echo ""
echo "Validating individual hooks..."

error_count=0
warning_count=0

for event in $(jq -r "$HOOKS_QUERY | keys[]" "$HOOKS_FILE"); do
  hook_count=$(jq -r "$HOOKS_QUERY.\"$event\" | length" "$HOOKS_FILE")

  for ((i=0; i<hook_count; i++)); do
    matcher=$(jq -r "$HOOKS_QUERY.\"$event\"[$i].matcher // empty" "$HOOKS_FILE")
    if [ -z "$matcher" ]; then
      if [ "$event" = "PreToolUse" ] || [ "$event" = "PostToolUse" ]; then
        echo "Warning: $event[$i] has no 'matcher' field and will match all tools"
        ((warning_count++))
      fi
    fi

    hooks=$(jq -r "$HOOKS_QUERY.\"$event\"[$i].hooks // empty" "$HOOKS_FILE")
    if [ -z "$hooks" ] || [ "$hooks" = "null" ]; then
      echo "Error: $event[$i] is missing 'hooks' array"
      ((error_count++))
      continue
    fi

    hook_array_count=$(jq -r "$HOOKS_QUERY.\"$event\"[$i].hooks | length" "$HOOKS_FILE")

    for ((j=0; j<hook_array_count; j++)); do
      hook_type=$(jq -r "$HOOKS_QUERY.\"$event\"[$i].hooks[$j].type // empty" "$HOOKS_FILE")

      if [ -z "$hook_type" ]; then
        echo "Error: $event[$i].hooks[$j] is missing 'type' field"
        ((error_count++))
        continue
      fi

      if [ "$hook_type" != "command" ] && [ "$hook_type" != "prompt" ]; then
        echo "Error: $event[$i].hooks[$j] has invalid type '$hook_type' (must be 'command' or 'prompt')"
        ((error_count++))
        continue
      fi

      if [ "$hook_type" = "command" ]; then
        command=$(jq -r "$HOOKS_QUERY.\"$event\"[$i].hooks[$j].command // empty" "$HOOKS_FILE")
        if [ -z "$command" ]; then
          echo "Error: $event[$i].hooks[$j] command hook must have 'command' field"
          ((error_count++))
        elif [[ "$command" == /* ]] && [[ "$command" != *'${CLAUDE_PLUGIN_ROOT}'* ]]; then
          echo "Warning: $event[$i].hooks[$j] uses hardcoded absolute path; consider \${CLAUDE_PLUGIN_ROOT}"
          ((warning_count++))
        fi
      else
        prompt=$(jq -r "$HOOKS_QUERY.\"$event\"[$i].hooks[$j].prompt // empty" "$HOOKS_FILE")
        if [ -z "$prompt" ]; then
          echo "Error: $event[$i].hooks[$j] prompt hook must have 'prompt' field"
          ((error_count++))
        fi

        if [ "$event" != "Stop" ] && [ "$event" != "SubagentStop" ] && [ "$event" != "UserPromptSubmit" ] && [ "$event" != "PreToolUse" ]; then
          echo "Warning: $event[$i].hooks[$j] prompt hooks are best supported on Stop, SubagentStop, UserPromptSubmit, and PreToolUse"
          ((warning_count++))
        fi
      fi

      timeout=$(jq -r "$HOOKS_QUERY.\"$event\"[$i].hooks[$j].timeout // empty" "$HOOKS_FILE")
      if [ -n "$timeout" ] && [ "$timeout" != "null" ]; then
        if ! [[ "$timeout" =~ ^[0-9]+$ ]]; then
          echo "Error: $event[$i].hooks[$j] timeout must be a number"
          ((error_count++))
        elif [ "$timeout" -gt 600 ]; then
          echo "Warning: $event[$i].hooks[$j] timeout $timeout seconds is very high (max 600s)"
          ((warning_count++))
        elif [ "$timeout" -lt 5 ]; then
          echo "Warning: $event[$i].hooks[$j] timeout $timeout seconds is very low"
          ((warning_count++))
        fi
      fi
    done
  done
done

echo ""
echo "----------------------------------------"
if [ $error_count -eq 0 ] && [ $warning_count -eq 0 ]; then
  echo "All checks passed"
  exit 0
elif [ $error_count -eq 0 ]; then
  echo "Validation passed with $warning_count warning(s)"
  exit 0
else
  echo "Validation failed with $error_count error(s) and $warning_count warning(s)"
  exit 1
fi
