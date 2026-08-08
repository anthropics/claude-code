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

# Check 3: Has frontmatter markers
MARKER_COUNT=$(grep -c '^---$' "$SETTINGS_FILE" 2>/dev/null || echo "0")

if [ "$MARKER_COUNT" -lt 2 ]; then
  echo "❌ Invalid frontmatter: found $MARKER_COUNT '---' markers (need at least 2)"
  echo "   Expected format:"
  echo "   ---"
  echo "   field: value"
  echo "   ---"
  echo "   Content..."
  exit 1
fi
echo "✅ Frontmatter markers present"

# Check 4: Extract and validate frontmatter
FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$SETTINGS_FILE")

if [ -z "$FRONTMATTER" ]; then
  echo "❌ Empty frontmatter (nothing between --- markers)"
  exit 1
fi
echo "✅ Frontmatter not empty"

# Check 5: Frontmatter has valid YAML-like structure
if ! echo "$FRONTMATTER" | grep -q ':'; then
  echo "⚠️  Warning: Frontmatter has no key:value pairs"
fi

# Check 6: Look for common fields
echo ""
echo "Detected fields:"
echo "$FRONTMATTER" | grep '^[a-z_][a-z0-9_]*:' | while IFS=':' read -r key value; do
  echo "  - $key: ${value:0:50}"
done

# Check 7: Validate common boolean fields
for field in enabled strict_mode; do
  # Escape regex metacharacters in field name before using in sed
  escaped_field=$(printf '%s\n' "$field" | sed 's/[[\.*^$()+?{|]/\\&/g')
  VALUE=$(echo "$FRONTMATTER" | grep "^${field}:" | sed "s/${escaped_field}: *//" || true)
  if [ -n "$VALUE" ]; then
    if [ "$VALUE" != "true" ] && [ "$VALUE" != "false" ]; then
      echo "⚠️  Field '$field' should be boolean (true/false), got: $VALUE"
    fi
  fi
done

# Check 8: Check body exists
BODY=$(awk '/^---$/{i++; next} i>=2' "$SETTINGS_FILE")

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
