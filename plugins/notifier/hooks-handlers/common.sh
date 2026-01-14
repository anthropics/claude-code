#!/bin/bash
# common.sh - Shared utilities for claude-code-notifier
# Sourced by notifier scripts

DATA_DIR="$HOME/.claude-code-notifier/data"

# Extract value from JSON using jq or fallback to grep/sed
# Usage: json_get "$JSON_STRING" "field_name"
json_get() {
    local json="$1"
    local field="$2"

    if command -v jq &> /dev/null; then
        echo "$json" | jq -r ".$field // empty" 2>/dev/null
    else
        echo "$json" | grep -oE "\"$field\":[[:space:]]*\"[^\"]*\"" | sed "s/\"$field\":[[:space:]]*\"\(.*\)\"/\1/" | head -1
    fi
}

# Get session ID from JSON, defaulting to "default"
# Usage: get_session_id "$JSON_STRING"
get_session_id() {
    local json="$1"
    local session_id

    session_id=$(json_get "$json" "session_id")
    echo "${session_id:-default}"
}

# Check if notification should be shown based on duration
# Returns 0 if should notify, 1 if should skip
# Usage: should_notify "$SESSION_ID" "$MIN_DURATION"
should_notify() {
    local session_id="$1"
    local min_duration="$2"
    local timestamp_file="$DATA_DIR/timestamp-${session_id}.txt"

    if [ ! -f "$timestamp_file" ]; then
        return 1
    fi

    local start_time
    start_time=$(cat "$timestamp_file" 2>/dev/null)
    local current_time
    current_time=$(date +%s)
    local elapsed=$((current_time - start_time))

    if [ "$elapsed" -lt "$min_duration" ]; then
        return 1
    fi

    return 0
}

# Get saved prompt text for session
# Usage: get_prompt_text "$SESSION_ID"
get_prompt_text() {
    local session_id="$1"
    local prompt_file="$DATA_DIR/prompt-${session_id}.txt"

    if [ -f "$prompt_file" ]; then
        cat "$prompt_file" 2>/dev/null
    fi
}
