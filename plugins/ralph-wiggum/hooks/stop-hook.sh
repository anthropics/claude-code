#!/bin/bash

# Ralph Wiggum Stop Hook
# Prevents session exit while that session's Ralph loop is active.

set -euo pipefail
export LC_ALL=C
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../scripts/ralph-state.sh
source "$SCRIPT_DIR/../scripts/ralph-state.sh"

# Keep persisted counters within the portable signed 32-bit arithmetic range.
readonly MAX_SUPPORTED_ITERATIONS=2147483647

HOOK_INPUT=$(cat)

block_safely() {
  local reason="$1"
  local message="$2"
  echo "$message" >&2
  jq -n --arg reason "$reason" --arg message "$message" '{
    decision: "block",
    reason: $reason,
    systemMessage: $message
  }'
  exit 0
}

normalize_iteration_decimal() {
  local value="$1"

  [[ "$value" =~ ^0*([0-9]+)$ ]] || return 1
  value="${BASH_REMATCH[1]}"

  if [[ ${#value} -gt ${#MAX_SUPPORTED_ITERATIONS} ]] ||
    { [[ ${#value} -eq ${#MAX_SUPPORTED_ITERATIONS} ]] &&
      [[ "$value" > "$MAX_SUPPORTED_ITERATIONS" ]]; }; then
    return 1
  fi

  printf '%s\n' "$value"
}

if ! HOOK_INPUT=$(printf '%s' "$HOOK_INPUT" | jq -ce 'if type == "object" then . else error("object required") end'); then
  echo "Ralph loop: invalid Stop hook input" >&2
  exit 2
fi

# Reject malformed hook input instead of letting truthy strings bypass Ralph's
# state machine. A missing field is supported for older hook payloads.
if ! printf '%s' "$HOOK_INPUT" | jq -e '
  if has("stop_hook_active") then
    (.stop_hook_active | type == "boolean")
  else
    true
  end
' >/dev/null; then
  echo "Ralph loop: stop_hook_active must be a boolean" >&2
  exit 2
fi

# Claude Code sets stop_hook_active after a Stop hook has already continued the
# session. Ralph still processes its finite state machine on those invocations:
# the transcript may contain the completion tag, and the persisted iteration
# must advance until the configured maximum is reached.

SESSION_ID=$(printf '%s' "$HOOK_INPUT" | jq -r '.session_id // empty')
if [[ ! "$SESSION_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]]; then
  echo "Ralph loop: missing or invalid session_id" >&2
  exit 2
fi

if ! ralph_resolve_state_path "$SESSION_ID"; then
  block_safely \
    "Ralph could not locate its private state. Restore the Claude configuration directory or run /cancel-ralph." \
    "Ralph loop: $RALPH_STATE_ERROR"
fi
STATE_ROOT="$RALPH_STATE_ROOT"
STATE_DIR="$RALPH_STATE_DIR"

if [[ -L "$STATE_ROOT" ]] || { [[ -e "$STATE_ROOT" ]] && \
  { [[ ! -d "$STATE_ROOT" ]] || [[ ! -O "$STATE_ROOT" ]]; }; }; then
  block_safely \
    "Ralph state path is unsafe. Restore ownership and remove redirects, then run /cancel-ralph." \
    "Ralph loop: refusing an unsafe private state path"
fi

if [[ ! -e "$STATE_DIR" && ! -L "$STATE_DIR" ]]; then
  exit 0
fi

if [[ ! -d "$STATE_ROOT" || ! -O "$STATE_ROOT" || -L "$STATE_ROOT" || \
  -L "$STATE_DIR" || \
  ! -d "$STATE_DIR" || ! -O "$STATE_DIR" || -L "$RALPH_STATE_FILE" ]]; then
  block_safely \
    "Ralph state path is unsafe. Restore ownership and remove redirects, then run /cancel-ralph." \
    "Ralph loop: refusing an unsafe private state path"
fi

if ! ralph_acquire_state_lock "$SESSION_ID"; then
  block_safely \
    "Ralph state is busy or unsafe. Retry or run /cancel-ralph." \
    "Ralph loop: $RALPH_STATE_ERROR"
fi
TEMP_FILE=""
cleanup() {
  if [[ -n "$TEMP_FILE" ]]; then
    rm -f -- "$TEMP_FILE" || true
  fi
  ralph_release_state_lock
}
trap cleanup EXIT

if [[ ! -e "$RALPH_STATE_FILE" ]]; then
  exit 0
fi

if [[ ! -f "$RALPH_STATE_FILE" || ! -O "$RALPH_STATE_FILE" ]]; then
  block_safely \
    "Ralph state is not a user-owned regular file. Repair it or run /cancel-ralph." \
    "Ralph loop: state is not a user-owned regular file"
fi

FRONTMATTER=$(awk '
  /^---$/ && delimiters < 2 { delimiters++; next }
  delimiters == 1 { print }
' "$RALPH_STATE_FILE")

field_value() {
  local field="$1"
  printf '%s\n' "$FRONTMATTER" | sed -n "s/^${field}:[[:space:]]*//p" | head -n 1
}

ITERATION=$(field_value iteration)
MAX_ITERATIONS=$(field_value max_iterations)
STORED_SESSION_ID=$(field_value session_id)
COMPLETION_PROMISE_JSON=$(field_value completion_promise)
STORED_PROJECT_ROOT_JSON=$(field_value project_root)
STORED_PROJECT_IDENTITY_JSON=$(field_value project_identity)

NORMALIZED_ITERATION=""
NORMALIZED_MAX_ITERATIONS=""
if ! NORMALIZED_ITERATION=$(normalize_iteration_decimal "$ITERATION") ||
  ! NORMALIZED_MAX_ITERATIONS=$(normalize_iteration_decimal "$MAX_ITERATIONS") ||
  [[ "$NORMALIZED_ITERATION" = "0" ]] ||
  [[ "$STORED_SESSION_ID" != "$SESSION_ID" ]]; then
  block_safely \
    "Ralph state is corrupted. Repair it or run /cancel-ralph; the state was preserved." \
    "Ralph loop: invalid numeric or session state"
fi
ITERATION="$NORMALIZED_ITERATION"
MAX_ITERATIONS="$NORMALIZED_MAX_ITERATIONS"

if ! STORED_PROJECT_ROOT=$(printf '%s' "$STORED_PROJECT_ROOT_JSON" | jq -er '
  select(type == "string" and startswith("/") and . != "/")
'); then
  block_safely \
    "Ralph state has an invalid project root. Repair it or run /cancel-ralph; the state was preserved." \
    "Ralph loop: invalid project root state"
fi
if ! STORED_PROJECT_IDENTITY=$(
  printf '%s' "$STORED_PROJECT_IDENTITY_JSON" |
    jq -er 'select(type == "string" and test("^[0-9]+:[0-9]+$"))'
); then
  block_safely \
    "Ralph state has no valid project identity. Restart or cancel the loop; the state was preserved." \
    "Ralph loop: invalid project identity state"
fi

if printf '%s' "$HOOK_INPUT" | jq -e 'has("cwd")' >/dev/null; then
  if ! CURRENT_CWD_INPUT=$(printf '%s' "$HOOK_INPUT" | jq -er '
    .cwd | select(type == "string" and startswith("/") and length > 1)
  '); then
    block_safely \
      "Ralph received an invalid current directory. Return to the original project or run /cancel-ralph; the state was preserved." \
      "Ralph loop: cwd must be an absolute non-root path"
  fi
elif [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
  CURRENT_CWD_INPUT="$CLAUDE_PROJECT_DIR"
else
  CURRENT_CWD_INPUT=$(pwd -P)
fi

if ! CURRENT_CWD=$(ralph_canonicalize_existing_directory "$CURRENT_CWD_INPUT"); then
  block_safely \
    "Ralph could not resolve the current directory. Return to the original project or run /cancel-ralph; the state was preserved." \
    "Ralph loop: current project directory is unavailable"
fi

if [[ -d "$STORED_PROJECT_ROOT" && ! -L "$STORED_PROJECT_ROOT" ]]; then
  if ! CANONICAL_STORED_PROJECT_ROOT=$(
    ralph_canonicalize_existing_directory "$STORED_PROJECT_ROOT"
  ) || [[ "$CANONICAL_STORED_PROJECT_ROOT" != "$STORED_PROJECT_ROOT" ]]; then
    block_safely \
      "Ralph's original project path is unsafe. Restore it or run /cancel-ralph; the state was preserved." \
      "Ralph loop: stored project root no longer resolves safely"
  fi
  if ! CURRENT_PROJECT_IDENTITY=$(
    ralph_directory_identity "$STORED_PROJECT_ROOT"
  ) || [[ "$CURRENT_PROJECT_IDENTITY" != "$STORED_PROJECT_IDENTITY" ]]; then
    block_safely \
      "Ralph's original project has changed. Restore it or run /cancel-ralph; the state was preserved." \
      "Ralph loop: original project directory identity changed"
  fi

  case "$CURRENT_CWD" in
    "$STORED_PROJECT_ROOT"|"$STORED_PROJECT_ROOT"/*)
      ;;
    *)
      block_safely \
        "Ralph is active in a different project. Return to the original project or run /cancel-ralph; the state was preserved." \
        "Ralph loop: refusing to continue in a different project"
      ;;
  esac
elif [[ ! -e "$STORED_PROJECT_ROOT" && ! -L "$STORED_PROJECT_ROOT" ]]; then
  # Keep private state cancellable when a project is deleted mid-loop, but do
  # not replay its prompt in whatever directory happens to be current.  First
  # authenticate the missing path through its nearest existing parent because
  # macOS may expose the same temporary path through /var and /private/var.
  if [[ -z "${CLAUDE_PROJECT_DIR:-}" ]] || \
    ! DELETED_PROJECT_IDENTITY=$(
      ralph_canonicalize_path_with_missing_suffix "$CLAUDE_PROJECT_DIR"
    ) || [[ "$DELETED_PROJECT_IDENTITY" != "$STORED_PROJECT_ROOT" ]]; then
    block_safely \
      "Ralph's original project is unavailable. Restore it or run /cancel-ralph; the state was preserved." \
      "Ralph loop: deleted project identity does not match"
  fi
  block_safely \
    "Ralph's original project is unavailable. Restore it or run /cancel-ralph; the state was preserved." \
    "Ralph loop: original project directory was deleted"
else
  block_safely \
    "Ralph's original project is unavailable or unsafe. Return to it or run /cancel-ralph; the state was preserved." \
    "Ralph loop: stored project root is unavailable or unsafe"
fi

if [[ "$COMPLETION_PROMISE_JSON" = "null" ]]; then
  COMPLETION_PROMISE=""
elif ! COMPLETION_PROMISE=$(printf '%s' "$COMPLETION_PROMISE_JSON" | jq -er 'if type == "string" then . else error("string required") end'); then
  block_safely \
    "Ralph state has an invalid completion promise. Repair it or run /cancel-ralph; the state was preserved." \
    "Ralph loop: invalid completion promise state"
fi

if [[ "$MAX_ITERATIONS" != "0" ]] && (( ITERATION >= MAX_ITERATIONS )); then
  echo "Ralph loop: max iterations ($MAX_ITERATIONS) reached"
  rm -- "$RALPH_STATE_FILE"
  exit 0
fi

if printf '%s' "$HOOK_INPUT" | jq -e 'has("last_assistant_message")' >/dev/null; then
  if ! LAST_OUTPUT=$(printf '%s' "$HOOK_INPUT" | jq -er '
    .last_assistant_message
    | select(type == "string" and length > 0)
  '); then
    block_safely \
      "Ralph received an invalid current assistant message. Retry or run /cancel-ralph; state was preserved." \
      "Ralph loop: last_assistant_message must be a non-empty string"
  fi
else
  # Older Stop payloads do not include last_assistant_message. For those only,
  # fall back to the complete JSONL transcript and retain the existing fail-safe
  # behavior for missing or malformed records.
  if ! TRANSCRIPT_PATH=$(printf '%s' "$HOOK_INPUT" | jq -er '.transcript_path | select(type == "string" and length > 0)'); then
    block_safely \
      "Ralph could not locate the session transcript. Retry after checking Claude Code's hook input." \
      "Ralph loop: transcript_path is missing"
  fi

  if [[ ! -f "$TRANSCRIPT_PATH" ]]; then
    block_safely \
      "Ralph could not read the session transcript. Retry after checking the transcript path." \
      "Ralph loop: transcript file not found"
  fi

  if ! LAST_OUTPUT=$(jq -ers '
    [
      .[]
      | select(.message.role? == "assistant")
      | .message.content?
      | if type == "array" then
          [ .[] | select(.type? == "text") | .text? // empty ] | join("\n")
        elif type == "string" then .
        else empty
        end
      | select(type == "string" and length > 0)
    ]
    | last
    | select(type == "string" and length > 0)
  ' "$TRANSCRIPT_PATH"); then
    block_safely \
      "Ralph could not parse the complete JSONL transcript. Fix the transcript or cancel the loop; state was preserved." \
      "Ralph loop: malformed or incomplete transcript"
  fi
fi

if [[ -n "$COMPLETION_PROMISE" ]]; then
  EXPECTED_TAG="<promise>${COMPLETION_PROMISE}</promise>"
  if [[ "$LAST_OUTPUT" == *"$EXPECTED_TAG"* ]]; then
    echo "Ralph loop: detected exact completion tag $EXPECTED_TAG"
    rm -- "$RALPH_STATE_FILE"
    exit 0
  fi
fi

PROMPT_TEXT=$(awk '
  /^---$/ && delimiters < 2 { delimiters++; next }
  delimiters == 2 { print }
' "$RALPH_STATE_FILE")

if [[ -z "$PROMPT_TEXT" ]]; then
  block_safely \
    "Ralph state has no prompt. Repair it or run /cancel-ralph; the state was preserved." \
    "Ralph loop: prompt is missing"
fi

if [[ "$ITERATION" = "$MAX_SUPPORTED_ITERATIONS" ]]; then
  block_safely \
    "Ralph reached the largest supported iteration count. Run /cancel-ralph or start a new loop; the state was preserved." \
    "Ralph loop: iteration cannot advance beyond $MAX_SUPPORTED_ITERATIONS"
fi

NEXT_ITERATION=$((ITERATION + 1))
TEMP_FILE=$(mktemp "$STATE_DIR/.${SESSION_ID}.XXXXXX")
chmod 600 "$TEMP_FILE"
if ! awk -v next_iteration="$NEXT_ITERATION" '
  /^---$/ && delimiters < 2 {
    delimiters++
    print
    next
  }
  delimiters == 1 && !updated && /^iteration:[[:space:]]*/ {
    print "iteration: " next_iteration
    updated = 1
    next
  }
  { print }
  END { if (!updated) exit 1 }
' "$RALPH_STATE_FILE" > "$TEMP_FILE"; then
  block_safely \
    "Ralph could not update its iteration safely. Repair the state or run /cancel-ralph; the original state was preserved." \
    "Ralph loop: failed to update frontmatter iteration"
fi
mv -- "$TEMP_FILE" "$RALPH_STATE_FILE"
TEMP_FILE=""

if [[ -n "$COMPLETION_PROMISE" ]]; then
  SYSTEM_MSG="Ralph iteration $NEXT_ITERATION | Stop only with the exact tag <promise>$COMPLETION_PROMISE</promise> when true"
else
  SYSTEM_MSG="Ralph iteration $NEXT_ITERATION | No completion promise is configured"
fi

jq -n --arg prompt "$PROMPT_TEXT" --arg message "$SYSTEM_MSG" '{
  decision: "block",
  reason: $prompt,
  systemMessage: $message
}'
