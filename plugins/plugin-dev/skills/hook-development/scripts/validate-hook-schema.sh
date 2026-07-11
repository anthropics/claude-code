#!/bin/bash
# Hook Schema Validator
# Validates plugin hooks.json files.

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <path/to/hooks.json>"
  echo ""
  echo "Validates hook configuration for:"
  echo "  - Valid JSON syntax and plugin wrapper structure"
  echo "  - Current hook event names"
  echo "  - Optional matcher fields and hook arrays"
  echo "  - command, http, mcp_tool, prompt, and agent handlers"
  echo "  - Type-specific required fields and timeout ranges"
  exit 1
fi

HOOKS_FILE="$1"

if [ ! -f "$HOOKS_FILE" ]; then
  echo "❌ Error: File not found: $HOOKS_FILE"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ Error: jq is required"
  exit 1
fi

if command -v bun >/dev/null 2>&1; then
  JAVASCRIPT_RUNTIME="bun"
elif command -v node >/dev/null 2>&1; then
  JAVASCRIPT_RUNTIME="node"
else
  echo "❌ Error: bun or node is required to validate JavaScript regular expressions"
  exit 1
fi

echo "🔍 Validating hooks configuration: $HOOKS_FILE"
echo ""
echo "Checking JSON syntax and root structure..."

if ! jq empty "$HOOKS_FILE" 2>/dev/null; then
  echo "❌ Invalid JSON syntax"
  exit 1
fi

# Plugin hooks.json files always use {"description": ..., "hooks": {...}}.
# Settings fragments are deliberately rejected so a malformed plugin file cannot
# silently validate and then be ignored at runtime.
if ! HOOKS_JSON=$(jq -ce '
  if type != "object" then
    error("the document root must be an object")
  elif (has("hooks") | not) then
    error("plugin hooks.json requires a top-level hooks wrapper")
  elif (.hooks | type) != "object" then
    error("the plugin wrapper hooks field must be an object")
  elif ((keys_unsorted - ["description", "hooks"]) | length) != 0 then
    error("the plugin wrapper only supports description and hooks")
  elif has("description") and (.description | type) != "string" then
    error("the plugin wrapper description must be a string")
  else
    .hooks
  end
' "$HOOKS_FILE" 2>/dev/null); then
  echo "❌ Invalid root structure: plugin hooks.json requires a top-level 'hooks' wrapper object"
  exit 1
fi

echo "✅ Valid JSON and root structure"

VALID_EVENTS=(
  SessionStart Setup UserPromptSubmit UserPromptExpansion
  PreToolUse PermissionRequest PermissionDenied PostToolUse
  PostToolUseFailure PostToolBatch Notification MessageDisplay
  SubagentStart SubagentStop TaskCreated TaskCompleted Stop StopFailure
  TeammateIdle InstructionsLoaded ConfigChange CwdChanged FileChanged
  WorktreeCreate WorktreeRemove PreCompact PostCompact Elicitation
  ElicitationResult SessionEnd
)

is_valid_event() {
  local candidate="$1"
  local valid_event
  for valid_event in "${VALID_EVENTS[@]}"; do
    if [ "$candidate" = "$valid_event" ]; then
      return 0
    fi
  done
  return 1
}

supports_handler_type() {
  local event="$1"
  local hook_type="$2"

  case "$event" in
    SessionStart|Setup)
      [ "$hook_type" = "command" ] || [ "$hook_type" = "mcp_tool" ]
      ;;
    MessageDisplay)
      # The official support table does not list MessageDisplay; its documented
      # registration examples use command handlers, so reject unlisted types.
      [ "$hook_type" = "command" ]
      ;;
    UserPromptSubmit|UserPromptExpansion|PreToolUse|PermissionRequest|PermissionDenied|PostToolUse|PostToolUseFailure|PostToolBatch|SubagentStop|TaskCreated|TaskCompleted|Stop|TeammateIdle)
      return 0
      ;;
    *)
      [ "$hook_type" = "command" ] || [ "$hook_type" = "http" ] || [ "$hook_type" = "mcp_tool" ]
      ;;
  esac
}

supports_matcher() {
  local event="$1"

  case "$event" in
    UserPromptSubmit|PostToolBatch|Stop|TeammateIdle|TaskCreated|TaskCompleted|WorktreeCreate|WorktreeRemove|MessageDisplay|CwdChanged)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

matcher_requires_regex_compilation() {
  local matcher="$1"

  # Claude Code treats these as match-all or an exact value/list rather than a
  # JavaScript regular expression. A hyphen and every other character take the
  # regular-expression path and are still checked by the JavaScript runtime.
  if [ -z "$matcher" ] || [ "$matcher" = "*" ] ||
    [[ "$matcher" =~ ^[A-Za-z0-9_[:space:],\|]+$ ]]; then
    return 1
  fi

  return 0
}

is_tool_event() {
  local event="$1"

  case "$event" in
    PreToolUse|PostToolUse|PostToolUseFailure|PermissionRequest|PermissionDenied)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

handler_has_field() {
  local event="$1"
  local group_index="$2"
  local handler_index="$3"
  local field="$4"

  jq -e \
    --arg event "$event" \
    --argjson i "$group_index" \
    --argjson j "$handler_index" \
    --arg field "$field" \
    '.[$event][$i].hooks[$j] | has($field)' \
    <<<"$HOOKS_JSON" >/dev/null
}

echo ""
echo "Validating events and handlers..."

error_count=0
warning_count=0

if [ "$(jq 'length' <<<"$HOOKS_JSON")" -eq 0 ]; then
  echo "❌ Hook event map must not be empty"
  error_count=$((error_count + 1))
fi

while IFS= read -r event; do
  if ! is_valid_event "$event"; then
    echo "❌ Unknown event type: $event"
    error_count=$((error_count + 1))
    continue
  fi

  if ! jq -e --arg event "$event" '.[$event] | type == "array"' <<<"$HOOKS_JSON" >/dev/null; then
    echo "❌ $event: Event configuration must be an array"
    error_count=$((error_count + 1))
    continue
  fi

  group_count=$(jq -r --arg event "$event" '.[$event] | length' <<<"$HOOKS_JSON")
  if [ "$group_count" -eq 0 ]; then
    echo "❌ $event: Event configuration must contain at least one hook group"
    error_count=$((error_count + 1))
    continue
  fi

  for ((i=0; i<group_count; i++)); do
    group_path="$event[$i]"

    if ! jq -e --arg event "$event" --argjson i "$i" '.[$event][$i] | type == "object"' <<<"$HOOKS_JSON" >/dev/null; then
      echo "❌ $group_path: Hook group must be an object"
      error_count=$((error_count + 1))
      continue
    fi

    while IFS= read -r group_key; do
      echo "❌ $group_path: Unknown group key '$group_key'"
      error_count=$((error_count + 1))
    done < <(
      jq -r --arg event "$event" --argjson i "$i" \
        '.[$event][$i] | keys_unsorted - ["matcher", "hooks"] | .[]' \
        <<<"$HOOKS_JSON"
    )

    # matcher is optional. When omitted, the group matches every invocation.
    if jq -e --arg event "$event" --argjson i "$i" '.[$event][$i] | has("matcher")' <<<"$HOOKS_JSON" >/dev/null; then
      if ! supports_matcher "$event"; then
        echo "❌ $group_path: $event does not support matcher"
        error_count=$((error_count + 1))
      elif ! jq -e --arg event "$event" --argjson i "$i" '.[$event][$i].matcher | type == "string"' <<<"$HOOKS_JSON" >/dev/null; then
        echo "❌ $group_path: matcher must be a string when present"
        error_count=$((error_count + 1))
      else
        matcher_value=$(jq -r --arg event "$event" --argjson i "$i" '.[$event][$i].matcher' <<<"$HOOKS_JSON")
        if matcher_requires_regex_compilation "$matcher_value" &&
          ! "$JAVASCRIPT_RUNTIME" -e \
            'try { new RegExp(process.argv[1]); } catch { process.exit(1); }' \
            -- "$matcher_value" >/dev/null 2>&1; then
          echo "❌ $group_path: matcher is an invalid regular expression for JavaScript"
          error_count=$((error_count + 1))
        fi
      fi
    fi

    if ! jq -e --arg event "$event" --argjson i "$i" '.[$event][$i].hooks | type == "array" and length > 0' <<<"$HOOKS_JSON" >/dev/null; then
      echo "❌ $group_path: Missing or empty 'hooks' array"
      error_count=$((error_count + 1))
      continue
    fi

    handler_count=$(jq -r --arg event "$event" --argjson i "$i" '.[$event][$i].hooks | length' <<<"$HOOKS_JSON")
    for ((j=0; j<handler_count; j++)); do
      handler_path="$group_path.hooks[$j]"

      if ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j] | type == "object"' <<<"$HOOKS_JSON" >/dev/null; then
        echo "❌ $handler_path: Hook handler must be an object"
        error_count=$((error_count + 1))
        continue
      fi

      while IFS= read -r handler_key; do
        echo "❌ $handler_path: Unknown handler key '$handler_key'"
        error_count=$((error_count + 1))
      done < <(
        jq -r --arg event "$event" --argjson i "$i" --argjson j "$j" \
          '.[$event][$i].hooks[$j] | keys_unsorted - ["type", "if", "timeout", "statusMessage", "once", "command", "args", "async", "asyncRewake", "shell", "url", "headers", "allowedEnvVars", "server", "tool", "input", "prompt", "model", "continueOnBlock"] | .[]' \
          <<<"$HOOKS_JSON"
      )

      hook_type=$(jq -r --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].type // ""' <<<"$HOOKS_JSON")
      case "$hook_type" in
        command|http|mcp_tool|prompt|agent)
          ;;
        "")
          echo "❌ $handler_path: Missing 'type' field"
          error_count=$((error_count + 1))
          continue
          ;;
        *)
          echo "❌ $handler_path: Invalid type '$hook_type'"
          error_count=$((error_count + 1))
          continue
          ;;
      esac

      if ! supports_handler_type "$event" "$hook_type"; then
        echo "❌ $handler_path: Handler type '$hook_type' is not supported for $event"
        error_count=$((error_count + 1))
      fi

      if handler_has_field "$event" "$i" "$j" "if"; then
        if ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].if | type == "string" and length > 0' <<<"$HOOKS_JSON" >/dev/null; then
          echo "❌ $handler_path: if must be a non-empty string"
          error_count=$((error_count + 1))
        fi
        if ! is_tool_event "$event"; then
          echo "❌ $handler_path: if is only evaluated on tool events; this hook would never run for $event"
          error_count=$((error_count + 1))
        fi
      fi

      if handler_has_field "$event" "$i" "$j" "statusMessage" &&
        ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].statusMessage | type == "string"' <<<"$HOOKS_JSON" >/dev/null; then
        echo "❌ $handler_path: statusMessage must be a string"
        error_count=$((error_count + 1))
      fi

      if handler_has_field "$event" "$i" "$j" "once"; then
        if ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].once | type == "boolean"' <<<"$HOOKS_JSON" >/dev/null; then
          echo "❌ $handler_path: once must be a boolean"
          error_count=$((error_count + 1))
        fi
        echo "❌ $handler_path: once is ignored in plugin and settings hooks; it is only honored in skill frontmatter"
        error_count=$((error_count + 1))
      fi

      for field in args async asyncRewake shell; do
        if [ "$hook_type" != "command" ] && handler_has_field "$event" "$i" "$j" "$field"; then
          echo "❌ $handler_path: $field is only valid for command hooks"
          error_count=$((error_count + 1))
        fi
      done

      for field in headers allowedEnvVars; do
        if [ "$hook_type" != "http" ] && handler_has_field "$event" "$i" "$j" "$field"; then
          echo "❌ $handler_path: $field is only valid for http hooks"
          error_count=$((error_count + 1))
        fi
      done

      if [ "$hook_type" != "mcp_tool" ] && handler_has_field "$event" "$i" "$j" "input"; then
        echo "❌ $handler_path: input is only valid for mcp_tool hooks"
        error_count=$((error_count + 1))
      fi

      for field in model continueOnBlock; do
        if [ "$hook_type" != "prompt" ] && [ "$hook_type" != "agent" ] && handler_has_field "$event" "$i" "$j" "$field"; then
          echo "❌ $handler_path: $field is only valid for prompt and agent hooks"
          error_count=$((error_count + 1))
        fi
      done

      case "$hook_type" in
        command)
          if ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].command | type == "string" and length > 0' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: Command hooks must have a non-empty 'command' field"
            error_count=$((error_count + 1))
          else
            command_value=$(jq -r --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].command' <<<"$HOOKS_JSON")
            if [[ "$command_value" == /* ]] && [[ "$command_value" != *'${CLAUDE_PLUGIN_ROOT}'* ]]; then
              echo "⚠️  $handler_path: Hardcoded absolute path detected; consider using \${CLAUDE_PLUGIN_ROOT}"
              warning_count=$((warning_count + 1))
            fi
          fi
          if handler_has_field "$event" "$i" "$j" "args" &&
            ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].args | type == "array" and all(.[]; type == "string")' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: args must be an array of strings"
            error_count=$((error_count + 1))
          fi
          if handler_has_field "$event" "$i" "$j" "async" &&
            ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].async | type == "boolean"' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: async must be a boolean"
            error_count=$((error_count + 1))
          fi
          if handler_has_field "$event" "$i" "$j" "asyncRewake" &&
            ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].asyncRewake | type == "boolean"' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: asyncRewake must be a boolean"
            error_count=$((error_count + 1))
          fi
          if handler_has_field "$event" "$i" "$j" "shell" &&
            ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].shell | type == "string" and (. == "bash" or . == "powershell")' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: shell must be 'bash' or 'powershell'"
            error_count=$((error_count + 1))
          fi
          ;;
        http)
          if ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].url | type == "string" and length > 0' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: HTTP hooks must have a non-empty 'url' field"
            error_count=$((error_count + 1))
          fi
          if handler_has_field "$event" "$i" "$j" "headers" &&
            ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].headers | type == "object" and all(.[]; type == "string")' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: headers must be an object with string values"
            error_count=$((error_count + 1))
          fi
          if handler_has_field "$event" "$i" "$j" "allowedEnvVars" &&
            ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].allowedEnvVars | type == "array" and all(.[]; type == "string")' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: allowedEnvVars must be an array of strings"
            error_count=$((error_count + 1))
          fi
          ;;
        mcp_tool)
          if ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j] | (.server | type == "string" and length > 0) and (.tool | type == "string" and length > 0)' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: MCP tool hooks must have non-empty 'server' and 'tool' fields"
            error_count=$((error_count + 1))
          fi
          if handler_has_field "$event" "$i" "$j" "input" &&
            ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].input | type == "object"' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: input must be an object"
            error_count=$((error_count + 1))
          fi
          ;;
        prompt|agent)
          if ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].prompt | type == "string" and length > 0' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: $hook_type hooks must have a non-empty 'prompt' field"
            error_count=$((error_count + 1))
          fi
          if handler_has_field "$event" "$i" "$j" "model" &&
            ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].model | type == "string" and length > 0' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: model must be a non-empty string"
            error_count=$((error_count + 1))
          fi
          if handler_has_field "$event" "$i" "$j" "continueOnBlock" &&
            ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].continueOnBlock | type == "boolean"' <<<"$HOOKS_JSON" >/dev/null; then
            echo "❌ $handler_path: continueOnBlock must be a boolean"
            error_count=$((error_count + 1))
          fi
          ;;
      esac

      if jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j] | has("timeout")' <<<"$HOOKS_JSON" >/dev/null; then
        if ! jq -e --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].timeout | type == "number" and . == floor and . > 0' <<<"$HOOKS_JSON" >/dev/null; then
          echo "❌ $handler_path: timeout must be a positive integer"
          error_count=$((error_count + 1))
        else
          timeout_value=$(jq -r --arg event "$event" --argjson i "$i" --argjson j "$j" '.[$event][$i].hooks[$j].timeout' <<<"$HOOKS_JSON")
          if [ "$timeout_value" -gt 600 ]; then
            echo "⚠️  $handler_path: Timeout $timeout_value seconds is very high"
            warning_count=$((warning_count + 1))
          fi
        fi
      fi
    done
  done
done < <(jq -r 'keys[]' <<<"$HOOKS_JSON")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$error_count" -eq 0 ] && [ "$warning_count" -eq 0 ]; then
  echo "✅ All checks passed!"
  exit 0
elif [ "$error_count" -eq 0 ]; then
  echo "⚠️  Validation passed with $warning_count warning(s)"
  exit 0
else
  echo "❌ Validation failed with $error_count error(s) and $warning_count warning(s)"
  exit 1
fi
