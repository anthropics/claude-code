#!/bin/bash

# Ralph Loop Setup Script
# Creates state isolated to the current Claude Code session.

set -euo pipefail
export LC_ALL=C
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=ralph-state.sh
source "$SCRIPT_DIR/ralph-state.sh"

# Keep persisted counters within the portable signed 32-bit arithmetic range.
readonly MAX_SUPPORTED_ITERATIONS=2147483647

usage() {
  cat <<'HELP_EOF'
Ralph Loop - Interactive self-referential development loop

USAGE:
  setup-ralph-loop.sh --session-id <id> --prompt <text> [OPTIONS]
  setup-ralph-loop.sh --session-id <id> [PROMPT...] [OPTIONS]

OPTIONS:
  --session-id <id>              Current Claude Code session ID
  --prompt <text>                Prompt as one literal argument
  --max-iterations <n>           Maximum iterations before auto-stop (0: no plugin limit)
  --completion-promise <text>    Exact phrase inside <promise> tags
  -h, --help                     Show this help message
HELP_EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
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

resolve_project_root() {
  local git_root

  if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
    printf '%s\n' "$CLAUDE_PROJECT_DIR"
  elif git_root=$(git rev-parse --show-toplevel 2>/dev/null); then
    printf '%s\n' "$git_root"
  else
    pwd
  fi
}

SESSION_ID="${CLAUDE_CODE_SESSION_ID:-}"
PROMPT=""
PROMPT_WAS_SET=false
PROMPT_PARTS=()
MAX_ITERATIONS=0
COMPLETION_PROMISE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --session-id)
      [[ -n "${2:-}" ]] || die "--session-id requires an argument"
      SESSION_ID="$2"
      shift 2
      ;;
    --prompt)
      [[ $# -ge 2 ]] || die "--prompt requires an argument"
      [[ "$PROMPT_WAS_SET" = false ]] || die "--prompt may only be specified once"
      PROMPT="$2"
      PROMPT_WAS_SET=true
      shift 2
      ;;
    --max-iterations)
      [[ -n "${2:-}" ]] || die "--max-iterations requires a number argument"
      [[ "$2" =~ ^[0-9]+$ ]] || die "--max-iterations must be a non-negative integer, got: $2"
      if ! MAX_ITERATIONS=$(normalize_iteration_decimal "$2"); then
        die "--max-iterations must not exceed $MAX_SUPPORTED_ITERATIONS, got: $2"
      fi
      shift 2
      ;;
    --completion-promise)
      [[ $# -ge 2 ]] || die "--completion-promise requires a text argument"
      [[ -n "$2" ]] || die "--completion-promise must not be empty"
      COMPLETION_PROMISE="$2"
      shift 2
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        PROMPT_PARTS+=("$1")
        shift
      done
      ;;
    -*)
      die "unknown option: $1"
      ;;
    *)
      PROMPT_PARTS+=("$1")
      shift
      ;;
  esac
done

if [[ ${#PROMPT_PARTS[@]} -gt 0 ]]; then
  [[ "$PROMPT_WAS_SET" = false ]] || die "do not combine --prompt with positional prompt arguments"
  PROMPT="${PROMPT_PARTS[*]}"
fi

[[ -n "$PROMPT" ]] || die "no prompt provided"
[[ "$SESSION_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || \
  die "session ID must contain only letters, numbers, dot, underscore, or hyphen"

PROJECT_ROOT=$(resolve_project_root)
[[ "$PROJECT_ROOT" = /* && "$PROJECT_ROOT" != "/" ]] || \
  die "project root must be an absolute non-root path"
[[ -d "$PROJECT_ROOT" && ! -L "$PROJECT_ROOT" ]] || \
  die "$PROJECT_ROOT is not a safe project directory"
if ! PROJECT_ROOT=$(ralph_canonicalize_existing_directory "$PROJECT_ROOT"); then
  die "project root could not be canonicalized"
fi
if ! PROJECT_IDENTITY=$(ralph_directory_identity "$PROJECT_ROOT"); then
  die "project root identity could not be determined"
fi

ralph_resolve_state_path "$SESSION_ID" || die "$RALPH_STATE_ERROR"
STATE_ROOT="$RALPH_STATE_ROOT"
STATE_DIR="$RALPH_STATE_DIR"
STATE_FILE="$RALPH_STATE_FILE"

# Prompts can contain credentials or other private task context. Keep them in
# the per-user Claude configuration tree instead of creating repository files.
if [[ -e "$STATE_ROOT" || -L "$STATE_ROOT" ]]; then
  [[ -d "$STATE_ROOT" && ! -L "$STATE_ROOT" && -O "$STATE_ROOT" ]] || \
    die "$STATE_ROOT must not be a symbolic link and must be a directory owned by the current user"
else
  mkdir -p -- "$STATE_ROOT"
fi
[[ ! -L "$STATE_DIR" ]] || die "$STATE_DIR must not be a symbolic link"
if [[ ! -e "$STATE_DIR" ]]; then
  mkdir -m 700 -- "$STATE_DIR" 2>/dev/null || true
fi
[[ -d "$STATE_DIR" && ! -L "$STATE_DIR" && -O "$STATE_DIR" ]] || \
  die "$STATE_DIR must be a directory owned by the current user"
chmod 700 "$STATE_DIR"

ralph_acquire_state_lock "$SESSION_ID" || die "$RALPH_STATE_ERROR"
TEMP_FILE=""
cleanup() {
  if [[ -n "$TEMP_FILE" ]]; then
    rm -f -- "$TEMP_FILE" || true
  fi
  ralph_release_state_lock
}
trap cleanup EXIT

if [[ -e "$STATE_FILE" || -L "$STATE_FILE" ]]; then
  die "a Ralph loop is already active for session $SESSION_ID; cancel it before starting another"
fi

if [[ -n "$COMPLETION_PROMISE" ]]; then
  COMPLETION_PROMISE_JSON=$(printf '%s' "$COMPLETION_PROMISE" | jq -Rs .)
else
  COMPLETION_PROMISE_JSON="null"
fi
PROJECT_ROOT_JSON=$(printf '%s' "$PROJECT_ROOT" | jq -Rs .)
PROJECT_IDENTITY_JSON=$(printf '%s' "$PROJECT_IDENTITY" | jq -Rs .)

TEMP_FILE=$(mktemp "$STATE_DIR/.${SESSION_ID}.XXXXXX")
chmod 600 "$TEMP_FILE"

{
  printf '%s\n' '---'
  printf 'active: true\n'
  printf 'iteration: 1\n'
  printf 'max_iterations: %s\n' "$MAX_ITERATIONS"
  printf 'completion_promise: %s\n' "$COMPLETION_PROMISE_JSON"
  printf 'session_id: %s\n' "$SESSION_ID"
  printf 'project_root: %s\n' "$PROJECT_ROOT_JSON"
  printf 'project_identity: %s\n' "$PROJECT_IDENTITY_JSON"
  printf 'started_at: "%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '%s\n' '---'
  printf '%s\n' "$PROMPT"
} > "$TEMP_FILE"

if ! ln -- "$TEMP_FILE" "$STATE_FILE"; then
  die "a Ralph loop became active for session $SESSION_ID; existing state was preserved"
fi
rm -- "$TEMP_FILE"
TEMP_FILE=""

echo "Ralph loop activated for session $SESSION_ID"
echo "State: $STATE_FILE"
echo "Iteration: 1"
if [[ "$MAX_ITERATIONS" != "0" ]]; then
  echo "Max iterations: $MAX_ITERATIONS"
else
  echo "Max iterations: no plugin limit"
fi

if [[ -n "$COMPLETION_PROMISE" ]]; then
  echo "Completion tag: <promise>$COMPLETION_PROMISE</promise>"
fi

echo
printf '%s\n' "$PROMPT"
