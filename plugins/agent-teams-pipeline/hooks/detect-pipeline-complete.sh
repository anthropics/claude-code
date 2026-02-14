#!/bin/bash
# Stop hook: detects "Pipeline Complete" in model output and warns user.
# Sets a flag file that PreToolUse hooks check to block further heavy work.

if [ "$CLAUDE_AGENT_TEAM_MEMBER" = "1" ]; then
  exit 0
fi

input=$(cat)

transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')
if [[ -z "$transcript_path" || ! -f "$transcript_path" ]]; then
    exit 0
fi

has_pipeline_complete=$(tail -30 "$transcript_path" | jq -s '
    [.[] | select(.type == "assistant" and .message.content)] |
    last |
    if . then
        [.message.content[] | select(.type == "text") | .text] |
        join(" ") |
        test("Pipeline Complete"; "i")
    else false end
' 2>/dev/null)

if [[ "$has_pipeline_complete" == "true" ]]; then
    HASH=$(echo "$transcript_path" | md5 2>/dev/null || echo "$transcript_path" | md5sum 2>/dev/null | cut -d' ' -f1)
    FLAG="/tmp/pipeline-complete-${HASH}.flag"

    if [[ ! -f "$FLAG" ]]; then
        echo "1" > "$FLAG"
        echo >&2 ""
        echo >&2 "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo >&2 "  PIPELINE COMPLETE DETECTED"
        echo >&2 "  Start a fresh session BEFORE your next message."
        echo >&2 "  Continuing in this session risks context exhaustion."
        echo >&2 "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo >&2 ""
    fi
fi
