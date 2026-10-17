#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
IDENTITY_DIR="$HOME/.claude/persistent-identity"
IDENTITY_FILE="$IDENTITY_DIR/identity.md"
PROJECTS_DIR="$IDENTITY_DIR/projects"

# --- Source word lists ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
source "$PLUGIN_ROOT/data/wordlists.sh"

# --- Ensure directory structure exists ---
mkdir -p "$IDENTITY_DIR"

# --- Read or create identity ---
if [[ -f "$IDENTITY_FILE" ]]; then
  IDENTITY_NAME=$(head -1 "$IDENTITY_FILE" | sed 's/^# //')
else
  # Generate random adjective-noun name
  ADJ_INDEX=$((RANDOM % ${#ADJECTIVES[@]}))
  NOUN_INDEX=$((RANDOM % ${#NOUNS[@]}))
  IDENTITY_NAME="${ADJECTIVES[$ADJ_INDEX]}-${NOUNS[$NOUN_INDEX]}"

  cat > "$IDENTITY_FILE" << EOF
# ${IDENTITY_NAME}

Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)

This is the persistent identity for this Claude Code installation.
Use /name to change your name.
EOF
fi

# --- Determine project and load memory ---
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

if command -v shasum &>/dev/null; then
  PROJECT_HASH=$(echo -n "$PROJECT_DIR" | shasum -a 256 | cut -c1-16)
else
  PROJECT_HASH=$(echo -n "$PROJECT_DIR" | sha256sum | cut -c1-16)
fi

PROJECT_MEMORY_DIR="$PROJECTS_DIR/$PROJECT_HASH"
MEMORY_FILE="$PROJECT_MEMORY_DIR/memory.md"

mkdir -p "$PROJECT_MEMORY_DIR"

# Write project info for reverse lookup
echo "$PROJECT_DIR" > "$PROJECT_MEMORY_DIR/project-info.txt"

# --- Read memory if it exists ---
MEMORY_CONTENT=""
if [[ -f "$MEMORY_FILE" ]] && [[ -s "$MEMORY_FILE" ]]; then
  MEMORY_CONTENT=$(cat "$MEMORY_FILE")
fi

# --- Build additionalContext ---
if [[ -n "$MEMORY_CONTENT" ]]; then
  MEMORY_SECTION="## Your Memory for This Project

The following are your notes from previous sessions in this project. Use them to maintain continuity.

${MEMORY_CONTENT}

---"
else
  MEMORY_SECTION="## Your Memory for This Project

You have no saved memories for this project yet. As you work, save important observations, decisions, and context to your memory file."
fi

CONTEXT="## Your Identity

You are **${IDENTITY_NAME}**. This is your persistent name across all sessions and projects. When greeting the user or referring to yourself, use this name naturally -- for example in your initial greeting or when asked who you are. Do not announce your name on every message.

${MEMORY_SECTION}

## Memory Management

You have a persistent memory file for this project at:
\`${MEMORY_FILE}\`

Write to this file when you learn something important that should persist across sessions:
- Key architectural decisions and their rationale
- User preferences for this project (coding style, conventions, preferred tools)
- Important context about the codebase that took effort to discover
- Recurring issues or patterns
- Your relationship with the user -- things they've shared, how they like to work

Keep your memory file organized with markdown headers. Update it incrementally -- append new sections or update existing ones. Keep entries concise and actionable.

Only write to your memory file when you have genuinely useful information to persist. Quality over quantity."

# --- JSON-escape and output ---
if command -v jq &>/dev/null; then
  ESCAPED_CONTEXT=$(echo "$CONTEXT" | jq -Rs .)
else
  ESCAPED_CONTEXT=$(echo "$CONTEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
fi

cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": ${ESCAPED_CONTEXT}
  }
}
EOF

exit 0
