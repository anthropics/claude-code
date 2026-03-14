#!/usr/bin/env bash

# RTL Text Support plugin - SessionStart hook
# Fixes: https://github.com/anthropics/claude-code/issues/29754
# Related: #29545, #29658, #29662
#
# Root cause: The VSCode extension webview/index.css introduced a global CSS rule
# in v2.1.63 that forces unicode-bidi: bidi-override on all elements, which
# reverses RTL text (Arabic, Hebrew, Persian/Farsi) making it unreadable.
#
# Fix: Patch the installed extension's index.css to change
#   * { direction: ltr; unicode-bidi: bidi-override; }
# to:
#   * { direction: ltr; unicode-bidi: normal; }
#
# This allows the browser's native Unicode Bidirectional Algorithm (BIDI)
# to handle RTL text correctly while keeping overall layout LTR.

set -euo pipefail

FIX_APPLIED=false
FIX_MESSAGE=""

# Locate all installed Claude Code extension webview CSS files
# Works on Linux/macOS for both VSCode and Cursor
for SEARCH_DIR in \
  "$HOME/.vscode/extensions" \
  "$HOME/.vscode-server/extensions" \
  "$HOME/.cursor/extensions" \
  "$HOME/Library/Application Support/Code/extensions" \
  "$HOME/Library/Application Support/Cursor/extensions"
do
  if [ ! -d "$SEARCH_DIR" ]; then
    continue
  fi

  # Find all matching index.css files in anthropic.claude-code-* extension dirs
  while IFS= read -r CSS_FILE; do
    if grep -q 'unicode-bidi: bidi-override' "$CSS_FILE" 2>/dev/null; then
      # Create backup before patching
      cp "$CSS_FILE" "${CSS_FILE}.rtl-backup" 2>/dev/null || true
      # Apply the fix: replace bidi-override with normal
      sed -i 's/unicode-bidi: bidi-override/unicode-bidi: normal/g' "$CSS_FILE"
      FIX_APPLIED=true
      FIX_MESSAGE="RTL CSS fix applied to: $CSS_FILE (backup saved as ${CSS_FILE}.rtl-backup)"
    fi
  done < <(find "$SEARCH_DIR" -path '*/anthropic.claude-code-*/webview/index.css' 2>/dev/null)
done

# Output JSON for Claude Code hook system
if [ "$FIX_APPLIED" = true ]; then
  STATUS="RTL text rendering fix was applied automatically. Persian/Arabic/Hebrew text should now display correctly in the chat panel. The webview CSS unicode-bidi property has been changed from bidi-override to normal. A backup of the original CSS was saved. Note: This fix will need to be re-applied after extension updates."
else
  STATUS="RTL text support plugin is active. No patching was needed (either already fixed or extension CSS not found at expected paths). If you are experiencing RTL text rendering issues, see the README for manual fix instructions."
fi

cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$STATUS"
  }
}
EOF

exit 0
