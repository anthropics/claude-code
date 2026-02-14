#!/bin/bash
# PreToolUse hook: blocks heavy operations after Pipeline Complete.
# The flag is set by detect-pipeline-complete.sh (Stop hook).
# Blocks: Task, TeamCreate, ExitPlanMode, Edit, Write, NotebookEdit
# Allows: Read, Bash, Glob, Grep, Skill (needed for session management)

if [ "$CLAUDE_AGENT_TEAM_MEMBER" = "1" ]; then
  exit 0
fi

input=$(cat)

transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')
if [[ -z "$transcript_path" ]]; then
    exit 0
fi

HASH=$(echo "$transcript_path" | md5 2>/dev/null || echo "$transcript_path" | md5sum 2>/dev/null | cut -d' ' -f1)
FLAG="/tmp/pipeline-complete-${HASH}.flag"

if [[ ! -f "$FLAG" ]]; then
    exit 0
fi

tool_name=$(echo "$input" | jq -r '.tool_name // "unknown"')

case "$tool_name" in
    Read|Bash|Glob|Grep|Skill|WebFetch|WebSearch|AskUserQuestion|TaskList|TaskGet|ToolSearch|SendMessage)
        exit 0
        ;;
esac

echo >&2 "[Hook] Pipeline Complete. Tool '${tool_name}' blocked."
echo >&2 "[Hook] Start a fresh session to continue work."
echo "{\"decision\": \"block\", \"reason\": \"Pipeline Complete was detected. Heavy operations are blocked to prevent context exhaustion. Start a fresh session, then continue your work there.\"}"
