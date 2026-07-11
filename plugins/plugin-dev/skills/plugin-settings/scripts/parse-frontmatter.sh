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

if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE" >&2
  exit 1
fi

if ! command -v ruby >/dev/null 2>&1; then
  echo "Error: ruby is required to parse YAML frontmatter" >&2
  exit 1
fi

exec ruby -rjson -rpsych - "$FILE" "$FIELD" <<'RUBY'
file, field = ARGV

begin
  lines = File.readlines(file, chomp: true, encoding: "UTF-8")
  unless lines.first == "---"
    warn "Error: Frontmatter must start on the first line of #{file}"
    exit 1
  end

  closing_offset = lines.drop(1).index("---")
  unless closing_offset
    warn "Error: No closing frontmatter marker found in #{file}"
    exit 1
  end

  frontmatter = lines[1, closing_offset].join("\n")
  if frontmatter.strip.empty?
    warn "Error: Empty frontmatter in #{file}"
    exit 1
  end

  metadata = Psych.safe_load(
    frontmatter,
    [],
    [],
    false,
    filename: file
  )
  unless metadata.is_a?(Hash)
    warn "Error: Frontmatter must be a YAML mapping in #{file}"
    exit 1
  end

  if field.empty?
    puts frontmatter
    exit 0
  end

  unless metadata.key?(field)
    warn "Error: Field '#{field}' not found in frontmatter"
    exit 1
  end

  value = metadata[field]
  case value
  when String, Numeric, TrueClass, FalseClass
    puts value
  when NilClass
    puts "null"
  else
    puts JSON.generate(value)
  end
rescue Psych::Exception, ArgumentError, EncodingError => error
  warn "Error: Invalid YAML frontmatter in #{file}: #{error.message}"
  exit 1
end
RUBY
