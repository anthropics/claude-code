#!/usr/bin/env bash
# fix-rtl-css.sh
#
# Standalone script to fix RTL (right-to-left) text rendering in the
# Claude Code VSCode extension webview.
#
# Root cause: v2.1.63 introduced a global CSS rule:
#   * { direction: ltr; unicode-bidi: bidi-override; }
# The unicode-bidi: bidi-override property forces all text LTR,
# breaking Persian/Arabic/Hebrew text rendering.
#
# This script replaces bidi-override with normal in the installed
# extension's webview/index.css file.
#
# Related issues:
#   https://github.com/anthropics/claude-code/issues/29754
#   https://github.com/anthropics/claude-code/issues/29658
#   https://github.com/anthropics/claude-code/issues/29545
#   https://github.com/anthropics/claude-code/issues/29662
#
# Usage:
#   chmod +x scripts/fix-rtl-css.sh
#   ./scripts/fix-rtl-css.sh
#
# Note: Re-run after every Claude Code extension update.

set -euo pipefail

echo "RTL CSS Fix for Claude Code VSCode Extension"
echo "=============================================="
echo ""

FIX_COUNT=0
NOT_FOUND=true

# Search paths for the extension on Linux/macOS (VSCode, VSCode-Server, Cursor)
SEARCH_DIRS=(
  "$HOME/.vscode/extensions"
  "$HOME/.vscode-server/extensions"
  "$HOME/.cursor/extensions"
  "$HOME/Library/Application Support/Code/extensions"
  "$HOME/Library/Application Support/Cursor/extensions"
)

for SEARCH_DIR in "${SEARCH_DIRS[@]}"; do
  if [ ! -d "$SEARCH_DIR" ]; then
    continue
  fi

  while IFS= read -r CSS_FILE; do
    NOT_FOUND=false
    echo "Found: $CSS_FILE"

    if grep -q 'unicode-bidi: bidi-override' "$CSS_FILE"; then
      echo "  Status: BROKEN (unicode-bidi: bidi-override found)"
      # Back up original
      cp "$CSS_FILE" "${CSS_FILE}.rtl-backup"
      echo "  Backup: ${CSS_FILE}.rtl-backup"
      # Apply fix
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/unicode-bidi: bidi-override/unicode-bidi: normal/g' "$CSS_FILE"
      else
        sed -i 's/unicode-bidi: bidi-override/unicode-bidi: normal/g' "$CSS_FILE"
      fi
      echo "  Fixed:  unicode-bidi changed to normal"
      FIX_COUNT=$((FIX_COUNT + 1))
    else
      echo "  Status: OK (no bidi-override found, may already be fixed)"
    fi
    echo ""
  done < <(find "$SEARCH_DIR" -path '*/anthropic.claude-code-*/webview/index.css' 2>/dev/null)
done

if [ "$NOT_FOUND" = true ]; then
  echo "No Claude Code extension CSS files found."
  echo "Make sure the Claude Code VSCode extension is installed."
  echo "Expected path: ~/.vscode/extensions/anthropic.claude-code-*/webview/index.css"
  exit 1
fi

if [ "$FIX_COUNT" -gt 0 ]; then
  echo "SUCCESS: Fixed $FIX_COUNT file(s)."
  echo "Please reload the VSCode window (Ctrl+Shift+P -> 'Developer: Reload Window')"
  echo "RTL text (Persian/Arabic/Hebrew) should now render correctly."
else
  echo "No fixes needed. RTL rendering may already be working correctly."
fi

exit 0
