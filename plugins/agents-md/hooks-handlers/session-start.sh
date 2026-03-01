#!/usr/bin/env bash
#
# AGENTS.md SessionStart Hook
#
# Reads AGENTS.md files and injects them into Claude Code's context
# when no CLAUDE.md is present at the same directory level.
#
# Behavior:
#   - Walks from project root up to filesystem root (mirrors CLAUDE.md loading)
#   - At each directory, if CLAUDE.md (or .claude/CLAUDE.md) exists, skip AGENTS.md
#   - If only AGENTS.md exists, read and collect it
#   - Concatenates all found AGENTS.md files (root-first order)
#   - Returns content via SessionStart additionalContext
#
# Supports: AGENTS.md at project root, parent directories, and .claude/AGENTS.md
#

set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

# Extract current working directory from hook input
CWD=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('cwd',''))" 2>/dev/null)

# Fallback to environment or pwd
if [ -z "$CWD" ]; then
  CWD="${CLAUDE_PROJECT_DIR:-$(pwd)}"
fi

# Collect directories from CWD up to root
dirs=()
dir="$CWD"
while [ "$dir" != "/" ]; do
  dirs+=("$dir")
  dir=$(dirname "$dir")
done

# Reverse to get root-first order (matches CLAUDE.md loading behavior)
reversed=()
for (( i=${#dirs[@]}-1; i>=0; i-- )); do
  reversed+=("${dirs[$i]}")
done

collected=""

for dir in "${reversed[@]}"; do
  # Check if CLAUDE.md exists at this level (any variant)
  has_claude_md=false
  if [ -f "$dir/CLAUDE.md" ] || [ -f "$dir/.claude/CLAUDE.md" ]; then
    has_claude_md=true
  fi

  # If CLAUDE.md exists here, skip AGENTS.md at this level
  if [ "$has_claude_md" = true ]; then
    continue
  fi

  # Look for AGENTS.md variants
  for agents_path in "$dir/AGENTS.md" "$dir/.claude/AGENTS.md"; do
    if [ -f "$agents_path" ]; then
      content=$(cat "$agents_path" 2>/dev/null || true)
      if [ -n "$content" ]; then
        if [ -n "$collected" ]; then
          collected="${collected}

"
        fi
        collected="${collected}Contents of ${agents_path} (project instructions from AGENTS.md, loaded by agents-md plugin):

${content}"
      fi
    fi
  done
done

# If nothing found, exit silently (no context to add)
if [ -z "$collected" ]; then
  exit 0
fi

# Truncate if excessively large (40k chars, matching CLAUDE.md warning threshold)
max_chars=40000
if [ "${#collected}" -gt "$max_chars" ]; then
  collected="${collected:0:$max_chars}

... [AGENTS.md content truncated at ${max_chars} characters]"
fi

# Output as JSON for SessionStart hook
# Use python3 for safe JSON encoding (handles special chars, newlines, quotes)
python3 -c "
import json, sys

content = sys.stdin.read()
output = {
    'hookSpecificOutput': {
        'hookEventName': 'SessionStart',
        'additionalContext': content
    }
}
print(json.dumps(output))
" <<< "$collected"

exit 0
