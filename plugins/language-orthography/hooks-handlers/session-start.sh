#!/usr/bin/env bash

# Reads the user's language setting and injects orthographic enforcement
# instructions so the model preserves diacritical marks in its output.

SETTINGS_FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
SETTINGS_LOCAL="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.local.json"

# Try local settings first, then global
LANG_VALUE=""
for f in "$SETTINGS_LOCAL" "$SETTINGS_FILE"; do
  if [ -f "$f" ]; then
    # Extract language field — handles both quoted and unquoted values
    LANG_VALUE=$(grep -o '"language"[[:space:]]*:[[:space:]]*"[^"]*"' "$f" 2>/dev/null | head -1 | sed 's/.*:[[:space:]]*"\(.*\)"/\1/')
    [ -n "$LANG_VALUE" ] && break
  fi
done

# If no language setting found, nothing to enforce
if [ -z "$LANG_VALUE" ]; then
  exit 0
fi

# Languages that require diacritical marks (non-exhaustive, covers most common cases)
# If the language is plain English, skip enforcement
case "$LANG_VALUE" in
  en|english|English|en-US|en-GB|en-AU)
    exit 0
    ;;
esac

cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "ORTHOGRAPHIC ENFORCEMENT (language: ${LANG_VALUE})\n\nThe user's language setting is '${LANG_VALUE}'. All text output in this language MUST maintain full orthographic correctness:\n\n- NEVER omit diacritical marks, accents, cedillas, umlauts, circumflexes, tildes, or any other characters required by the language's writing system.\n- Dropping diacritics (e.g. writing 'informacao' instead of 'informação', or 'voce' instead of 'você') is an orthographic error equivalent to a typo or misspelling in English.\n- This applies to ALL text: messages, code comments, strings, commit messages, file contents, and any other output in ${LANG_VALUE}.\n- This rule persists through the entire session, including after context compaction.\n\nTreat this as a hard constraint, not a style preference."
  }
}
EOF

exit 0
