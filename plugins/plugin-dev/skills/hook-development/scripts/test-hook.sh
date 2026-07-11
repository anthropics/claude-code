#!/bin/bash
# Hook Testing Helper
# Tests a hook with sample input and shows output

set -euo pipefail

# Usage
show_usage() {
  local exit_code="${1:-0}"

  echo "Usage: $0 [options] <hook-script> <test-input.json>"
  echo ""
  echo "Options:"
  echo "  -h, --help      Show this help message"
  echo "  -v, --verbose   Show detailed execution information"
  echo "  -t, --timeout N Set timeout in seconds (default: 60)"
  echo ""
  echo "Examples:"
  echo "  $0 validate-bash.sh test-input.json"
  echo "  $0 -v -t 30 validate-write.sh write-input.json"
  echo ""
  echo "Creates sample test input with:"
  echo "  $0 --create-sample <event-type>"
  exit "$exit_code"
}

# Create sample input
create_sample() {
  event_type="$1"

  case "$event_type" in
    PreToolUse)
      cat <<'EOF'
{
  "session_id": "test-session",
  "transcript_path": "/tmp/transcript.txt",
  "cwd": "/tmp/test-project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/tmp/test.txt",
    "content": "Test content"
  }
}
EOF
      ;;
    PostToolUse)
      cat <<'EOF'
{
  "session_id": "test-session",
  "transcript_path": "/tmp/transcript.txt",
  "cwd": "/tmp/test-project",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "printf 'sample'"
  },
  "tool_response": {
    "stdout": "sample",
    "stderr": "",
    "interrupted": false
  }
}
EOF
      ;;
    Stop)
      cat <<'EOF'
{
  "session_id": "test-session",
  "transcript_path": "/tmp/transcript.txt",
  "cwd": "/tmp/test-project",
  "permission_mode": "default",
  "hook_event_name": "Stop",
  "stop_hook_active": false,
  "last_assistant_message": "The requested task is complete."
}
EOF
      ;;
    SubagentStop)
      cat <<'EOF'
{
  "session_id": "test-session",
  "transcript_path": "/tmp/transcript.txt",
  "cwd": "/tmp/test-project",
  "permission_mode": "default",
  "hook_event_name": "SubagentStop",
  "stop_hook_active": false,
  "agent_id": "test-agent-id",
  "agent_type": "test-agent",
  "agent_transcript_path": "/tmp/agent-transcript.jsonl",
  "last_assistant_message": "The delegated task is complete."
}
EOF
      ;;
    UserPromptSubmit)
      cat <<'EOF'
{
  "session_id": "test-session",
  "transcript_path": "/tmp/transcript.txt",
  "cwd": "/tmp/test-project",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Test user prompt"
}
EOF
      ;;
    SessionStart)
      cat <<'EOF'
{
  "session_id": "test-session",
  "transcript_path": "/tmp/transcript.txt",
  "cwd": "/tmp/test-project",
  "permission_mode": "default",
  "hook_event_name": "SessionStart",
  "source": "startup"
}
EOF
      ;;
    Setup)
      cat <<'EOF'
{
  "session_id": "test-session",
  "transcript_path": "/tmp/transcript.txt",
  "cwd": "/tmp/test-project",
  "permission_mode": "default",
  "hook_event_name": "Setup",
  "trigger": "init"
}
EOF
      ;;
    SessionEnd)
      cat <<'EOF'
{
  "session_id": "test-session",
  "transcript_path": "/tmp/transcript.txt",
  "cwd": "/tmp/test-project",
  "permission_mode": "default",
  "hook_event_name": "SessionEnd",
  "reason": "other"
}
EOF
      ;;
    *)
      echo "Unknown event type: $event_type"
      echo "Valid types: PreToolUse, PostToolUse, Stop, SubagentStop, UserPromptSubmit, SessionStart, Setup, SessionEnd"
      exit 1
      ;;
  esac
}

# Parse arguments
VERBOSE=false
TIMEOUT=60

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)
      show_usage 0
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -t|--timeout)
      if [ $# -lt 2 ]; then
        echo "Error: --timeout requires a positive integer"
        exit 1
      fi
      TIMEOUT="$2"
      shift 2
      ;;
    --create-sample)
      if [ $# -lt 2 ]; then
        echo "Error: --create-sample requires an event type"
        exit 1
      fi
      create_sample "$2"
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

if ! [[ "$TIMEOUT" =~ ^[1-9][0-9]*$ ]]; then
  echo "Error: Timeout must be a positive integer: $TIMEOUT"
  exit 1
fi

if [ $# -ne 2 ]; then
  echo "Error: Missing required arguments"
  echo ""
  show_usage 1
fi

HOOK_SCRIPT="$1"
TEST_INPUT="$2"

# Validate inputs
if [ ! -f "$HOOK_SCRIPT" ]; then
  echo "❌ Error: Hook script not found: $HOOK_SCRIPT"
  exit 1
fi

if [ -x "$HOOK_SCRIPT" ]; then
  HOOK_COMMAND=("$HOOK_SCRIPT")
else
  echo "⚠️  Warning: Hook script is not executable. Attempting to run with bash..."
  HOOK_COMMAND=(bash "$HOOK_SCRIPT")
fi

if [ ! -f "$TEST_INPUT" ]; then
  echo "❌ Error: Test input not found: $TEST_INPUT"
  exit 1
fi

# Validate test input JSON
if ! jq empty "$TEST_INPUT" 2>/dev/null; then
  echo "❌ Error: Test input is not valid JSON"
  exit 1
fi

if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_COMMAND=(timeout)
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_COMMAND=(gtimeout)
else
  echo "❌ Error: test-hook.sh requires 'timeout' or 'gtimeout' (GNU coreutils)"
  exit 1
fi

echo "🧪 Testing hook: ${HOOK_COMMAND[*]}"
echo "📥 Input: $TEST_INPUT"
echo ""

if [ "$VERBOSE" = true ]; then
  echo "Input JSON:"
  jq . "$TEST_INPUT"
  echo ""
fi

# Set up environment
export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(pwd)}"

# Caller-provided project and environment paths belong to the caller and must
# never be removed by this helper. Keep all defaults under one private runtime
# directory and clean up only that directory.
TEST_RUNTIME_DIR=""
cleanup_test_environment() {
  case "${TEST_RUNTIME_DIR:-}" in
    ""|/)
      return
      ;;
  esac
  rm -rf -- "$TEST_RUNTIME_DIR"
}
ensure_test_runtime_directory() {
  if [ -z "$TEST_RUNTIME_DIR" ]; then
    TEST_RUNTIME_DIR=$(mktemp -d "${TMPDIR:-/tmp}/claude-hook-test.XXXXXX")
    chmod 700 "$TEST_RUNTIME_DIR"
  fi
}
trap cleanup_test_environment EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

if [ -z "${CLAUDE_PROJECT_DIR:-}" ]; then
  ensure_test_runtime_directory
  export CLAUDE_PROJECT_DIR="$TEST_RUNTIME_DIR/project"
  mkdir -m 700 -- "$CLAUDE_PROJECT_DIR"
else
  export CLAUDE_PROJECT_DIR
fi

if [ -z "${CLAUDE_ENV_FILE:-}" ]; then
  ensure_test_runtime_directory
  export CLAUDE_ENV_FILE="$TEST_RUNTIME_DIR/claude-env"
else
  export CLAUDE_ENV_FILE
fi

if [ "$VERBOSE" = true ]; then
  echo "Environment:"
  echo "  CLAUDE_PROJECT_DIR=$CLAUDE_PROJECT_DIR"
  echo "  CLAUDE_PLUGIN_ROOT=$CLAUDE_PLUGIN_ROOT"
  echo "  CLAUDE_ENV_FILE=$CLAUDE_ENV_FILE"
  echo ""
fi

# Run the hook
echo "▶️  Running hook (timeout: ${TIMEOUT}s)..."
echo ""

start_time=$(date +%s)

set +e
output=$("${TIMEOUT_COMMAND[@]}" "$TIMEOUT" "${HOOK_COMMAND[@]}" < "$TEST_INPUT" 2>&1)
exit_code=$?
set -e

end_time=$(date +%s)
duration=$((end_time - start_time))

# Analyze results
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results:"
echo ""
echo "Exit Code: $exit_code"
echo "Duration: ${duration}s"
echo ""

case $exit_code in
  0)
    echo "✅ Hook approved/succeeded"
    ;;
  2)
    echo "🚫 Hook blocked/denied"
    ;;
  124)
    echo "⏱️  Hook timed out after ${TIMEOUT}s"
    ;;
  *)
    echo "⚠️  Hook returned unexpected exit code: $exit_code"
    ;;
esac

echo ""
echo "Output:"
if [ -n "$output" ]; then
  echo "$output"
  echo ""

  # Try to parse as JSON
  if echo "$output" | jq empty 2>/dev/null; then
    echo "Parsed JSON output:"
    echo "$output" | jq .
  fi
else
  echo "(no output)"
fi

# Check for environment file
if [ -f "$CLAUDE_ENV_FILE" ]; then
  echo ""
  echo "Environment file created:"
  cat "$CLAUDE_ENV_FILE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $exit_code -eq 0 ] || [ $exit_code -eq 2 ]; then
  echo "✅ Test completed successfully"
  exit 0
else
  echo "❌ Test failed"
  exit 1
fi
