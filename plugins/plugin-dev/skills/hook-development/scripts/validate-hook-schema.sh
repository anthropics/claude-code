#!/bin/bash
# Hook Schema Validator
# Validates hooks.json structure and checks for common issues

set -euo pipefail

# Usage
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
  echo "❌ Error: File not found: $HOOKS_FILE"
  exit 1
fi

echo "🔍 Validating hooks configuration: $HOOKS_FILE"
echo ""

# Check 1: Valid JSON
echo "Checking JSON syntax..."
if ! jq empty "$HOOKS_FILE" 2>/dev/null; then
  echo "❌ Invalid JSON syntax"
  exit 1
fi
echo "✅ Valid JSON"

# Check 2: Detect format (plugin wrapper vs direct)
echo ""
echo "Detecting hook format..."

# Plugin wrapper format has a "hooks" key containing the actual events
# Direct format has events at the root level
if jq -e '.hooks' "$HOOKS_FILE" > /dev/null 2>&1; then
  HOOKS_ROOT=".hooks"
  IS_WRAPPER=true
  echo "✅ Detected plugin wrapper format"

  # Validate description field if present
  if jq -e '.description' "$HOOKS_FILE" > /dev/null 2>&1; then
    desc_type=$(jq -r '.description | type' "$HOOKS_FILE")
    if [ "$desc_type" != "string" ]; then
      echo "⚠️  'description' field should be a string"
    fi
  fi
else
  HOOKS_ROOT="."
  IS_WRAPPER=false
  echo "✅ Detected direct/settings format"
fi

# Helper function to build jq path
# Usage: build_path "event" or build_path "event" "[0]" ".hooks"
build_path() {
  local event="$1"
  shift
  local suffix="${*:-}"

  if [ "$IS_WRAPPER" = true ]; then
    echo ".hooks.\"$event\"$suffix"
  else
    echo ".\"$event\"$suffix"
  fi
}

# Check 3: Root structure
echo ""
echo "Checking root structure..."
VALID_EVENTS=("PreToolUse" "PostToolUse" "UserPromptSubmit" "Stop" "SubagentStop" "SessionStart" "SessionEnd" "PreCompact" "Notification")

for event in $(jq -r "$HOOKS_ROOT | keys[]" "$HOOKS_FILE"); do
  found=false
  for valid_event in "${VALID_EVENTS[@]}"; do
    if [ "$event" = "$valid_event" ]; then
      found=true
      break
    fi
  done

  if [ "$found" = false ]; then
    echo "⚠️  Unknown event type: $event"
  fi
done
echo "✅ Root structure valid"

# Check 4: Validate each hook
echo ""
echo "Validating individual hooks..."

error_count=0
warning_count=0

for event in $(jq -r "$HOOKS_ROOT | keys[]" "$HOOKS_FILE"); do
  hook_count=$(jq -r "$(build_path "$event") | length" "$HOOKS_FILE")

  for ((i=0; i<hook_count; i++)); do
    # Check matcher exists
    matcher=$(jq -r "$(build_path "$event" "[$i].matcher") // empty" "$HOOKS_FILE")
    if [ -z "$matcher" ]; then
      echo "❌ $event[$i]: Missing 'matcher' field"
      ((error_count++))
      continue
    fi

    # Check hooks array exists
    hooks=$(jq -r "$(build_path "$event" "[$i].hooks") // empty" "$HOOKS_FILE")
    if [ -z "$hooks" ] || [ "$hooks" = "null" ]; then
      echo "❌ $event[$i]: Missing 'hooks' array"
      ((error_count++))
      continue
    fi

    # Validate each hook in the array
    hook_array_count=$(jq -r "$(build_path "$event" "[$i].hooks") | length" "$HOOKS_FILE")

    for ((j=0; j<hook_array_count; j++)); do
      hook_type=$(jq -r "$(build_path "$event" "[$i].hooks[$j].type") // empty" "$HOOKS_FILE")

      if [ -z "$hook_type" ]; then
        echo "❌ $event[$i].hooks[$j]: Missing 'type' field"
        ((error_count++))
        continue
      fi

      if [ "$hook_type" != "command" ] && [ "$hook_type" != "prompt" ]; then
        echo "❌ $event[$i].hooks[$j]: Invalid type '$hook_type' (must be 'command' or 'prompt')"
        ((error_count++))
        continue
      fi

      # Check type-specific fields
      if [ "$hook_type" = "command" ]; then
        command=$(jq -r "$(build_path "$event" "[$i].hooks[$j].command") // empty" "$HOOKS_FILE")
        if [ -z "$command" ]; then
          echo "❌ $event[$i].hooks[$j]: Command hooks must have 'command' field"
          ((error_count++))
        else
          # Check for hardcoded paths
          if [[ "$command" == /* ]] && [[ "$command" != *'${CLAUDE_PLUGIN_ROOT}'* ]]; then
            echo "⚠️  $event[$i].hooks[$j]: Hardcoded absolute path detected. Consider using \${CLAUDE_PLUGIN_ROOT}"
            ((warning_count++))
          fi
        fi
      elif [ "$hook_type" = "prompt" ]; then
        prompt=$(jq -r "$(build_path "$event" "[$i].hooks[$j].prompt") // empty" "$HOOKS_FILE")
        if [ -z "$prompt" ]; then
          echo "❌ $event[$i].hooks[$j]: Prompt hooks must have 'prompt' field"
          ((error_count++))
        fi

        # Check if prompt-based hooks are used on supported events
        if [ "$event" != "Stop" ] && [ "$event" != "SubagentStop" ] && [ "$event" != "UserPromptSubmit" ] && [ "$event" != "PreToolUse" ]; then
          echo "⚠️  $event[$i].hooks[$j]: Prompt hooks may not be fully supported on $event (best on Stop, SubagentStop, UserPromptSubmit, PreToolUse)"
          ((warning_count++))
        fi
      fi

      # Check timeout
      timeout=$(jq -r "$(build_path "$event" "[$i].hooks[$j].timeout") // empty" "$HOOKS_FILE")
      if [ -n "$timeout" ] && [ "$timeout" != "null" ]; then
        if ! [[ "$timeout" =~ ^[0-9]+$ ]]; then
          echo "❌ $event[$i].hooks[$j]: Timeout must be a number"
          ((error_count++))
        elif [ "$timeout" -gt 600 ]; then
          echo "⚠️  $event[$i].hooks[$j]: Timeout $timeout seconds is very high (max 600s)"
          ((warning_count++))
        elif [ "$timeout" -lt 5 ]; then
          echo "⚠️  $event[$i].hooks[$j]: Timeout $timeout seconds is very low"
          ((warning_count++))
        fi
      fi
    done
  done
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $error_count -eq 0 ] && [ $warning_count -eq 0 ]; then
  echo "✅ All checks passed!"
  exit 0
elif [ $error_count -eq 0 ]; then
  echo "⚠️  Validation passed with $warning_count warning(s)"
  exit 0
else
  echo "❌ Validation failed with $error_count error(s) and $warning_count warning(s)"
  exit 1
fi
