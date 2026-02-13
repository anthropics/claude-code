#!/bin/bash
# Stop hook: suggests starting a fresh session when context usage exceeds 75%.
# Retry guard: max 2 blocks per transcript to prevent infinite loops.

if [ "$CLAUDE_AGENT_TEAM_MEMBER" = "1" ]; then
  exit 0
fi

input=$(cat)

stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false')
if [[ "$stop_hook_active" == "true" ]]; then
    exit 0
fi

transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')
if [[ -z "$transcript_path" || ! -f "$transcript_path" ]]; then
    exit 0
fi

BLOCK_KEY=$(echo "$transcript_path" | md5 2>/dev/null || echo "$transcript_path" | md5sum 2>/dev/null | cut -d' ' -f1 || echo "fallback")
BLOCK_COUNTER="/tmp/claude-stop-block-${BLOCK_KEY}"
if [ -f "$BLOCK_COUNTER" ]; then
    prev_count=$(cat "$BLOCK_COUNTER" 2>/dev/null || echo "0")
    if [ "$prev_count" -ge 2 ]; then
        rm -f "$BLOCK_COUNTER"
        echo >&2 "[Hook] check-context: retry guard exhausted (blocked ${prev_count}x). Allowing stop."
        exit 0
    fi
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

if [[ $pct -ge 75 ]]; then
    prev_count=0
    [ -f "$BLOCK_COUNTER" ] && prev_count=$(cat "$BLOCK_COUNTER" 2>/dev/null || echo "0")
    echo $((prev_count + 1)) > "$BLOCK_COUNTER"
    echo "{\"decision\": \"block\", \"reason\": \"Context usage is at ${pct}%. Please start a fresh session so work can continue with a clean context window.\"}"
fi
