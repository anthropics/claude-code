#!/usr/bin/env bash
#
# bash-workdir-guard: PreToolUse hook for Claude Code
#
# Detects Bash commands that navigate outside the project workspace boundary
# and blocks with an advisory suggesting safer alternatives.
#
# Input (stdin): JSON with tool_input.command and cwd
# Output: exit 0 = allow, exit 2 + stderr message = block with advisory

set -euo pipefail

# Read the hook input from stdin
INPUT=$(cat)

# Extract the command being run
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Get project directory from environment (set by Claude Code)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"

if [ -z "$PROJECT_DIR" ]; then
  exit 0
fi

# Normalize project dir (resolve symlinks, remove trailing slash)
PROJECT_DIR=$(cd "$PROJECT_DIR" 2>/dev/null && pwd -P) || exit 0

# Extract cd targets from the command
# Matches: cd /path, cd ~/path, cd ../, cd /tmp, pushd /path
# Does NOT match: cd subdir (relative within project)
CD_TARGETS=$(echo "$COMMAND" | grep -oE '(cd|pushd)[[:space:]]+[^[:space:];&|]+' | awk '{print $2}' || true)

if [ -z "$CD_TARGETS" ]; then
  exit 0
fi

for TARGET in $CD_TARGETS; do
  # Skip relative paths that stay within project (no leading / or ~ or ..)
  case "$TARGET" in
    /*|~/*|../*|..)
      # This could go outside the project — check it
      ;;
    *)
      # Relative path, likely stays in project
      continue
      ;;
  esac

  # Resolve the target path
  RESOLVED=""
  case "$TARGET" in
    /*)  RESOLVED="$TARGET" ;;
    '~'/*) RESOLVED="${HOME}/${TARGET#'~'/}" ;;
    '~')   RESOLVED="${HOME}" ;;
    *)
      # Resolve relative to current cwd from the hook input
      CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
      if [ -n "$CWD" ]; then
        RESOLVED=$(cd "$CWD" 2>/dev/null && cd "$TARGET" 2>/dev/null && pwd -P) || continue
      else
        continue
      fi
      ;;
  esac

  # Canonicalize if the path exists
  if [ -d "$RESOLVED" ]; then
    RESOLVED=$(cd "$RESOLVED" 2>/dev/null && pwd -P) || continue
  fi

  # Check if resolved path is outside project
  case "$RESOLVED" in
    "$PROJECT_DIR"|"$PROJECT_DIR"/*)
      # Inside project — no warning needed
      continue
      ;;
    *)
      # Outside project — block with advisory
      SAFE_TARGET=$(printf '%s' "$TARGET")
      cat >&2 <<GUARD_EOF
[bash-workdir-guard] Blocked: command navigates to '${SAFE_TARGET}' which is outside the project workspace.

Claude Code auto-resets cwd to the workspace after external navigation. Use these alternatives instead:
  - Absolute paths: ls ${SAFE_TARGET} (no cd needed)
  - Tool flags: git -C ${SAFE_TARGET} status, make -C ${SAFE_TARGET} build
  - Subshells: (cd ${SAFE_TARGET} && command)

Ref: https://github.com/anthropics/claude-code/issues/45478
GUARD_EOF
      exit 2
      ;;
  esac
done

# All cd targets are within project, allow
exit 0
