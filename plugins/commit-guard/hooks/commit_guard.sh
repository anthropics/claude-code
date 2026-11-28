#!/usr/bin/env bash
#
# commit-guard: PreToolUse hook for Claude Code
#
# Blocks git add/commit when the command targets sensitive files
# (.env, credentials, private keys, tokens, etc.)
#
# Input (stdin): JSON with tool_input.command
# Output: exit 0 = allow, exit 2 + stderr = block with advisory

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Only check git add and git commit commands
# Match: git add, git commit -a, git commit --all
IS_GIT_ADD=false
IS_GIT_COMMIT_ALL=false

if echo "$COMMAND" | grep -qE '(^|&&|;|[|])\s*git\s+add\b'; then
  IS_GIT_ADD=true
fi

if echo "$COMMAND" | grep -qE '(^|&&|;|[|])\s*git\s+commit\s+.*(-a|--all)\b'; then
  IS_GIT_COMMIT_ALL=true
fi

if [ "$IS_GIT_ADD" = false ] && [ "$IS_GIT_COMMIT_ALL" = false ]; then
  exit 0
fi

# Sensitive file patterns
SENSITIVE_PATTERNS=(
  '\.env$'
  '\.env\.'
  'credentials\.json'
  'credentials\.yml'
  'credentials\.yaml'
  'service[_-]account.*\.json'
  '\.pem$'
  '\.key$'
  '\.p12$'
  '\.pfx$'
  'id_rsa'
  'id_ed25519'
  'id_ecdsa'
  '\.secret'
  'token\.json'
  '\.keystore'
  '\.jks$'
  'htpasswd'
  'shadow$'
)

# Build a single regex from all patterns
COMBINED_PATTERN=$(IFS='|'; echo "${SENSITIVE_PATTERNS[*]}")

# For git add: check the files being added
if [ "$IS_GIT_ADD" = true ]; then
  # Extract file arguments after 'git add'
  # Handle: git add .env, git add -A, git add ., git add file1 file2
  ADD_ARGS=$(echo "$COMMAND" | grep -oE '(^|&&|;|[|])\s*git\s+add\s+(.+)' | sed 's/.*git\s\+add\s\+//')

  # Check for broad adds that would include everything
  if echo "$ADD_ARGS" | grep -qE '^\s*(-A|--all|\.|--update|-u)\s*$'; then
    # Broad add — check if any sensitive files exist in the working tree
    PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
    FOUND_FILES=""
    for PATTERN in "${SENSITIVE_PATTERNS[@]}"; do
      MATCHES=$(find "$PROJECT_DIR" -maxdepth 3 -regex ".*${PATTERN}" -not -path '*/.git/*' -not -path '*/node_modules/*' 2>/dev/null | head -5)
      if [ -n "$MATCHES" ]; then
        FOUND_FILES="${FOUND_FILES}${MATCHES}\n"
      fi
    done

    if [ -n "$FOUND_FILES" ]; then
      cat >&2 <<GUARD_EOF
[commit-guard] Blocked: 'git add' with broad scope would include sensitive files:

$(echo -e "$FOUND_FILES" | head -10)

Add files individually instead of using 'git add -A' or 'git add .',
or add these files to .gitignore first:

  echo '.env' >> .gitignore
  git add specific-file.ts
GUARD_EOF
      exit 2
    fi
    exit 0
  fi

  # Specific files — check each one
  for FILE in $ADD_ARGS; do
    # Skip flags
    case "$FILE" in
      -*) continue ;;
    esac
    if echo "$FILE" | grep -qE "$COMBINED_PATTERN"; then
      cat >&2 <<GUARD_EOF
[commit-guard] Blocked: '$FILE' matches a sensitive file pattern.

This file may contain secrets, credentials, or private keys.
If this is intentional, add it to .gitignore first or use:

  COMMIT_GUARD_ALLOW='$FILE' git add $FILE
GUARD_EOF
      exit 2
    fi
  done
fi

# For git commit -a/--all: check staged + unstaged sensitive files
if [ "$IS_GIT_COMMIT_ALL" = true ]; then
  PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
  FOUND_FILES=""
  for PATTERN in "${SENSITIVE_PATTERNS[@]}"; do
    MATCHES=$(find "$PROJECT_DIR" -maxdepth 3 -regex ".*${PATTERN}" -not -path '*/.git/*' -not -path '*/node_modules/*' 2>/dev/null | head -5)
    if [ -n "$MATCHES" ]; then
      FOUND_FILES="${FOUND_FILES}${MATCHES}\n"
    fi
  done

  if [ -n "$FOUND_FILES" ]; then
    cat >&2 <<GUARD_EOF
[commit-guard] Blocked: 'git commit -a' would include sensitive files:

$(echo -e "$FOUND_FILES" | head -10)

Stage files individually instead:

  git add specific-file.ts
  git commit -m "your message"
GUARD_EOF
    exit 2
  fi
fi

exit 0
