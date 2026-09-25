#!/bin/bash
# Frontmatter Parser Utility
# Extracts YAML frontmatter from .local.md files

set -euo pipefail

# Usage
show_usage() {
  echo "Usage: $0 <settings-file.md> [field-name]"
  echo ""
  echo "Examples:"
  echo "  # Show all frontmatter"
  echo "  $0 .claude/my-plugin.local.md"
  echo ""
  echo "  # Extract specific field"
  echo "  $0 .claude/my-plugin.local.md enabled"
  echo ""
  echo "  # Extract and use in script"
  echo "  ENABLED=\$($0 .claude/my-plugin.local.md enabled)"
  exit 0
}

if [ $# -eq 0 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
  show_usage
fi

FILE="$1"
FIELD="${2:-}"

# Validate file
if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE" >&2
  exit 1
fi

# Extract frontmatter
FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$FILE")

if [ -z "$FRONTMATTER" ]; then
  echo "Error: No frontmatter found in $FILE" >&2
  exit 1
fi

# If no field specified, output all frontmatter
if [ -z "$FIELD" ]; then
  echo "$FRONTMATTER"
  exit 0
fi

# Extract specific field
VALUE=$(echo "$FRONTMATTER" | grep "^${FIELD}:" | sed "s/${FIELD}: *//" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\\(.*\\)'$/\\1/")

if [ -z "$VALUE" ]; then
  echo "Error: Field '$FIELD' not found in frontmatter" >&2
  exit 1
fi

echo "$VALUE"
exit 0
