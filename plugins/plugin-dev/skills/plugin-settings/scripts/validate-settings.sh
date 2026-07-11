#!/bin/bash
# Settings File Validator
# Validates .claude/plugin-name.local.md structure

set -euo pipefail

# Usage
if [ $# -eq 0 ]; then
  echo "Usage: $0 <path/to/settings.local.md>"
  echo ""
  echo "Validates plugin settings file for:"
  echo "  - File existence and readability"
  echo "  - YAML frontmatter structure"
  echo "  - Required --- markers"
  echo "  - Field format"
  echo ""
  echo "Example: $0 .claude/my-plugin.local.md"
  exit 1
fi

SETTINGS_FILE="$1"
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PARSER="$SCRIPT_DIR/parse-frontmatter.sh"

echo "🔍 Validating settings file: $SETTINGS_FILE"
echo ""

# Check 1: File exists
if [ ! -f "$SETTINGS_FILE" ]; then
  echo "❌ File not found: $SETTINGS_FILE"
  exit 1
fi
echo "✅ File exists"

# Check 2: File is readable
if [ ! -r "$SETTINGS_FILE" ]; then
  echo "❌ File is not readable"
  exit 1
fi
echo "✅ File is readable"

# Check 3: Parse the leading YAML frontmatter with the shared helper.
if ! FRONTMATTER=$("$PARSER" "$SETTINGS_FILE" 2>&1); then
  echo "❌ Invalid YAML frontmatter"
  echo "   $FRONTMATTER"
  exit 1
fi
echo "✅ Frontmatter markers present"
echo "✅ Frontmatter not empty"
echo "✅ Frontmatter is valid YAML"

# Check 4: Look for common fields
echo ""
echo "Detected fields:"
while IFS=':' read -r key value; do
  [ -n "$key" ] || continue
  echo "  - $key: ${value:0:50}"
done < <(printf '%s\n' "$FRONTMATTER" | awk '/^[a-z_][a-z0-9_]*:/')

# Check 5: Validate common boolean fields by their YAML types.
invalid_boolean=0
for field in enabled strict_mode; do
  RAW_VALUE=$(printf '%s\n' "$FRONTMATTER" | awk -v key="$field" '
    index($0, key ":") == 1 {
      print substr($0, length(key) + 2)
      exit
    }
  ')
  if [ -n "$RAW_VALUE" ] && ! [[ "$RAW_VALUE" =~ ^[[:space:]]*(true|false)([[:space:]]*#.*)?$ ]]; then
    echo "❌ Field '$field' must be a YAML boolean (true/false), got:${RAW_VALUE}"
    invalid_boolean=1
  fi
done
if [ "$invalid_boolean" -ne 0 ]; then
  exit 1
fi

# Check 6: Check body exists, preserving later markdown horizontal rules.
BODY=$(awk '
  NR == 1 { next }
  !closed && $0 == "---" { closed = 1; next }
  closed { print }
' "$SETTINGS_FILE")

echo ""
if [ -n "$BODY" ]; then
  BODY_LINES=$(echo "$BODY" | wc -l | tr -d ' ')
  echo "✅ Markdown body present ($BODY_LINES lines)"
else
  echo "⚠️  No markdown body (frontmatter only)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Settings file structure is valid"
echo ""
echo "Reminder: Changes to this file require restarting Claude Code"
exit 0
