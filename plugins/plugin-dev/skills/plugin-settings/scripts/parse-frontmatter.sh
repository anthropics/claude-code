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

# Extract only the opening frontmatter block. A range-based sed expression
# restarts at later Markdown horizontal rules and can mix body text into it.
FRONTMATTER=$(awk '
  NR == 1 {
    if ($0 != "---") exit 1
    next
  }
  /^---$/ {
    found_end = 1
    exit
  }
  { print }
  END {
    if (!found_end) exit 1
  }
' "$FILE") || {
  echo "Error: No frontmatter found in $FILE" >&2
  exit 1
}

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
