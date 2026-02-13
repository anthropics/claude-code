#!/bin/bash
# PreToolUse hook: blocks ExitPlanMode and TeamCreate when context > 55%.
# Why: At 55%+ context, starting a new implementation phase will push context
# past 60-70% where the model can enter unrecoverable extended-thinking loops.

# Skip for team members (they have short-lived sessions)
if [ "$CLAUDE_AGENT_TEAM_MEMBER" = "1" ]; then
  exit 0
fi

input=$(cat)

transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')
if [[ -z "$transcript_path" || ! -f "$transcript_path" ]]; then
    exit 0
fi

max_context=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
[[ -z "$max_context" || "$max_context" == "null" ]] && max_context=200000

context_length=$(jq -s '
    map(select(.message.usage and .isSidechain != true and .isApiErrorMessage != true)) |
    last |
    if . then
        (.message.usage.input_tokens // 0) +
        (.message.usage.cache_read_input_tokens // 0) +
        (.message.usage.cache_creation_input_tokens // 0)
    else 0 end
' < "$transcript_path")

if [[ -z "$context_length" || "$context_length" -eq 0 ]]; then
    exit 0
fi

pct=$((context_length * 100 / max_context))

tool_name=$(echo "$input" | jq -r '.tool_name // "unknown"')

if [[ $pct -ge 55 ]]; then
    echo >&2 "[Hook] CONTEXT WARNING: ${pct}% used. ${tool_name} will push context higher."
    echo >&2 "[Hook] Start a fresh session before beginning new heavy work (plan execution, team spawn)."
    echo "{\"decision\": \"block\", \"reason\": \"Context is at ${pct}% — too high to start ${tool_name}. Start a fresh session first, then retry.\"}"
fi
