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
  echo "  - Plugin wrapper format (optional description + hooks)"
  echo "  - Required fields"
  echo "  - Hook type validity"
  echo "  - Matcher patterns"
  echo "  - Timeout ranges"
  echo "  - Shell-form \${user_config.*} (rejected since Claude Code v2.1.207)"
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

# Check 2: Root structure
# Plugin hooks.json uses {"description"?: string, "hooks": { Event: [...] }}
# Settings-style files place events at the top level.
echo ""
echo "Checking root structure..."

if jq -e 'type == "object" and has("hooks") and (.hooks | type == "object")' "$HOOKS_FILE" >/dev/null 2>&1; then
  HOOKS_JSON=$(jq -c '.hooks' "$HOOKS_FILE")
  echo "✅ Plugin wrapper format detected (hooks key)"

  # Unknown top-level keys other than description/hooks are worth a note
  for key in $(jq -r 'keys[]' "$HOOKS_FILE"); do
    if [ "$key" != "hooks" ] && [ "$key" != "description" ]; then
      echo "⚠️  Unknown top-level field: $key (expected description and/or hooks)"
    fi
  done
else
  HOOKS_JSON=$(jq -c '.' "$HOOKS_FILE")
  echo "✅ Direct event-map format detected"
fi

VALID_EVENTS=("PreToolUse" "PostToolUse" "UserPromptSubmit" "Stop" "SubagentStop" "SessionStart" "SessionEnd" "PreCompact" "Notification")

for event in $(echo "$HOOKS_JSON" | jq -r 'keys[]'); do
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

# Check 3: Validate each hook
echo ""
echo "Validating individual hooks..."

error_count=0
warning_count=0

for event in $(echo "$HOOKS_JSON" | jq -r 'keys[]'); do
  hook_count=$(echo "$HOOKS_JSON" | jq -r ".\"$event\" | length")

  for ((i=0; i<hook_count; i++)); do
    # matcher is optional: omit or "*" matches every occurrence of the event
    matcher=$(echo "$HOOKS_JSON" | jq -r ".\"$event\"[$i].matcher // empty")
    if [ -z "$matcher" ]; then
      echo "💡 $event[$i]: No matcher (fires on every $event occurrence)"
    fi

    # Check hooks array exists
    hooks=$(echo "$HOOKS_JSON" | jq -r ".\"$event\"[$i].hooks // empty")
    if [ -z "$hooks" ] || [ "$hooks" = "null" ]; then
      echo "❌ $event[$i]: Missing 'hooks' array"
      error_count=$((error_count + 1))
      continue
    fi

    # Validate each hook in the array
    hook_array_count=$(echo "$HOOKS_JSON" | jq -r ".\"$event\"[$i].hooks | length")

    for ((j=0; j<hook_array_count; j++)); do
      hook_type=$(echo "$HOOKS_JSON" | jq -r ".\"$event\"[$i].hooks[$j].type // empty")

      if [ -z "$hook_type" ]; then
        echo "❌ $event[$i].hooks[$j]: Missing 'type' field"
        error_count=$((error_count + 1))
        continue
      fi

      if [ "$hook_type" != "command" ] && [ "$hook_type" != "prompt" ]; then
        echo "❌ $event[$i].hooks[$j]: Invalid type '$hook_type' (must be 'command' or 'prompt')"
        error_count=$((error_count + 1))
        continue
      fi

      # Check type-specific fields
      if [ "$hook_type" = "command" ]; then
        command=$(echo "$HOOKS_JSON" | jq -r ".\"$event\"[$i].hooks[$j].command // empty")
        if [ -z "$command" ]; then
          echo "❌ $event[$i].hooks[$j]: Command hooks must have 'command' field"
          error_count=$((error_count + 1))
        else
          # Check for hardcoded paths
          if [[ "$command" == /* ]] && [[ "$command" != *'${CLAUDE_PLUGIN_ROOT}'* ]]; then
            echo "⚠️  $event[$i].hooks[$j]: Hardcoded absolute path detected. Consider using \${CLAUDE_PLUGIN_ROOT}"
            warning_count=$((warning_count + 1))
          fi

          # As of Claude Code v2.1.207, ${user_config.*} is rejected in shell-form
          # plugin hook commands (shell-injection fix). Detect shell form (no args)
          # and warn authors to migrate.
          has_args=$(echo "$HOOKS_JSON" | jq -r ".\"$event\"[$i].hooks[$j] | has(\"args\")")
          if echo "$command" | grep -q '\${user_config\.'; then
            if [ "$has_args" = "true" ]; then
              echo "💡 $event[$i].hooks[$j]: \${user_config.*} in exec form (args present) is OK; prefer \$CLAUDE_PLUGIN_OPTION_<KEY> inside the script"
            else
              echo "❌ $event[$i].hooks[$j]: \${user_config.*} in shell-form command is rejected since Claude Code v2.1.207 (shell-injection fix)"
              echo "   Fix: use exec form with \"args\", or read \$CLAUDE_PLUGIN_OPTION_<KEY> inside the script"
              error_count=$((error_count + 1))
            fi
          fi

          # Also scan each args element for documentation completeness
          if [ "$has_args" = "true" ]; then
            args_joined=$(echo "$HOOKS_JSON" | jq -r ".\"$event\"[$i].hooks[$j].args // [] | join(\" \")")
            if echo "$args_joined" | grep -q '\${user_config\.'; then
              echo "💡 $event[$i].hooks[$j]: Passing \${user_config.*} via args is accepted; ensure the value is treated as data, not re-evaluated by a shell"
            fi
          fi
        fi
      elif [ "$hook_type" = "prompt" ]; then
        prompt=$(echo "$HOOKS_JSON" | jq -r ".\"$event\"[$i].hooks[$j].prompt // empty")
        if [ -z "$prompt" ]; then
          echo "❌ $event[$i].hooks[$j]: Prompt hooks must have 'prompt' field"
          error_count=$((error_count + 1))
        fi

        # Check if prompt-based hooks are used on supported events
        if [ "$event" != "Stop" ] && [ "$event" != "SubagentStop" ] && [ "$event" != "UserPromptSubmit" ] && [ "$event" != "PreToolUse" ]; then
          echo "⚠️  $event[$i].hooks[$j]: Prompt hooks may not be fully supported on $event (best on Stop, SubagentStop, UserPromptSubmit, PreToolUse)"
          warning_count=$((warning_count + 1))
        fi
      fi

      # Check timeout
      timeout=$(echo "$HOOKS_JSON" | jq -r ".\"$event\"[$i].hooks[$j].timeout // empty")
      if [ -n "$timeout" ] && [ "$timeout" != "null" ]; then
        if ! [[ "$timeout" =~ ^[0-9]+$ ]]; then
          echo "❌ $event[$i].hooks[$j]: Timeout must be a number"
          error_count=$((error_count + 1))
        elif [ "$timeout" -gt 600 ]; then
          echo "⚠️  $event[$i].hooks[$j]: Timeout $timeout seconds is very high (max 600s)"
          warning_count=$((warning_count + 1))
        elif [ "$timeout" -lt 5 ]; then
          echo "⚠️  $event[$i].hooks[$j]: Timeout $timeout seconds is very low"
          warning_count=$((warning_count + 1))
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
