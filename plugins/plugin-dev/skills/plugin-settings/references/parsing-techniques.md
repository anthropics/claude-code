# Settings File Parsing Techniques

Complete guide to parsing `.claude/plugin-name.local.md` files in bash scripts.

## File Structure

Settings files use markdown with YAML frontmatter:

```markdown
---
field1: value1
field2: "value with spaces"
numeric_field: 42
boolean_field: true
list_field: ["item1", "item2", "item3"]
---

# Markdown Content

This body content can be extracted separately.
It's useful for prompts, documentation, or additional context.
```

## Parsing Frontmatter

### Extract Frontmatter Block

```bash
#!/bin/bash
FILE=".claude/my-plugin.local.md"
PARSER="${CLAUDE_PLUGIN_ROOT}/skills/plugin-settings/scripts/parse-frontmatter.sh"

# Validate YAML and extract only the leading frontmatter block.
FRONTMATTER=$("$PARSER" "$FILE")
```

**How it works:**
- Requires the opening marker on the first line
- Stops at the first closing marker, even if the markdown body contains `---`
- Uses Ruby Psych to reject malformed YAML before returning values

### Extract Individual Fields

**String fields:**
```bash
VALUE=$("$PARSER" "$FILE" field_name)
```

**Boolean fields:**
```bash
ENABLED=$("$PARSER" "$FILE" enabled)

# Use in condition
if [[ "$ENABLED" == "true" ]]; then
  # Enabled
fi
```

**Numeric fields:**
```bash
MAX=$("$PARSER" "$FILE" max_value)

# Validate it's a number
if [[ "$MAX" =~ ^[0-9]+$ ]]; then
  # Use in numeric comparison
  if [[ $MAX -gt 100 ]]; then
    # Too large
  fi
fi
```

**List fields (simple):**
```bash
# YAML: list: ["item1", "item2", "item3"]
LIST=$("$PARSER" "$FILE" list)
# Result is a JSON array: ["item1","item2","item3"]

# For simple checks:
if [[ "$LIST" == *"item1"* ]]; then
  # List contains item1
fi
```

**List fields (proper parsing with jq):**
```bash
# For proper list handling, use yq or convert to JSON
# This requires yq to be installed (brew install yq)

# The shared parser already emits arrays and mappings as JSON.
LIST=$("$PARSER" "$FILE" list)

# Iterate over items
echo "$LIST" | jq -r '.[]' | while read -r item; do
  echo "Processing: $item"
done
```

## Parsing Markdown Body

### Extract Body Content

```bash
#!/bin/bash
FILE=".claude/my-plugin.local.md"

# Extract everything after the first closing marker.
BODY=$(awk 'NR == 1 { next } !closed && $0 == "---" { closed = 1; next } closed { print }' "$FILE")
```

**How it works:**
- The first line is the required opening marker
- The first later `---` switches to body mode
- Later `---` lines are preserved as markdown content

**Handles edge case:** If `---` appears in the markdown body, it still works because we only count the first two `---` at the start.

### Use Body as Prompt

```bash
# Extract body
PROMPT=$(awk 'NR == 1 { next } !closed && $0 == "---" { closed = 1; next } closed { print }' "$RALPH_STATE_FILE")

# Feed back to Claude
echo '{"decision": "block", "reason": "'"$PROMPT"'"}' | jq .
```

**Important:** Use `jq -n --arg` for safer JSON construction with user content:

```bash
PROMPT=$(awk 'NR == 1 { next } !closed && $0 == "---" { closed = 1; next } closed { print }' "$FILE")

# Safe JSON construction
jq -n --arg prompt "$PROMPT" '{
  "decision": "block",
  "reason": $prompt
}'
```

## Common Parsing Patterns

### Pattern: Field with Default

```bash
VALUE=$("$PARSER" "$FILE" field 2>/dev/null || printf 'default_value')
```

### Pattern: Optional Field

```bash
OPTIONAL=$("$PARSER" "$FILE" optional_field 2>/dev/null || true)

# Only use if present
if [[ -n "$OPTIONAL" ]] && [[ "$OPTIONAL" != "null" ]]; then
  # Field is set, use it
  echo "Optional field: $OPTIONAL"
fi
```

### Pattern: Multiple Fields

```bash
# Each lookup is YAML-aware and exact; similarly named or nested keys do not collide.
ENABLED=$("$PARSER" "$FILE" enabled 2>/dev/null || printf 'false')
MODE=$("$PARSER" "$FILE" mode 2>/dev/null || printf 'standard')
MAX_SIZE=$("$PARSER" "$FILE" max_size 2>/dev/null || printf '1000000')
```

## Updating Settings Files

### Atomic Updates

Always use temp file + atomic move to prevent corruption:

```bash
#!/bin/bash
FILE=".claude/my-plugin.local.md"
NEW_VALUE="updated_value"

# Create temp file
TEMP_FILE="${FILE}.tmp.$$"

# Update field using sed
sed "s/^field_name: .*/field_name: $NEW_VALUE/" "$FILE" > "$TEMP_FILE"

# Atomic replace
mv "$TEMP_FILE" "$FILE"
```

### Update Single Field

```bash
# Increment iteration counter
CURRENT=$("$PARSER" "$FILE" iteration)
NEXT=$((CURRENT + 1))

# Update file
TEMP_FILE="${FILE}.tmp.$$"
sed "s/^iteration: .*/iteration: $NEXT/" "$FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$FILE"
```

### Update Multiple Fields

```bash
# Update several fields at once
TEMP_FILE="${FILE}.tmp.$$"

sed -e "s/^iteration: .*/iteration: $NEXT_ITERATION/" \
    -e "s/^pr_number: .*/pr_number: $PR_NUMBER/" \
    -e "s/^status: .*/status: $NEW_STATUS/" \
    "$FILE" > "$TEMP_FILE"

mv "$TEMP_FILE" "$FILE"
```

## Validation Techniques

### Validate File Exists and Is Readable

```bash
FILE=".claude/my-plugin.local.md"

if [[ ! -f "$FILE" ]]; then
  echo "Settings file not found" >&2
  exit 1
fi

if [[ ! -r "$FILE" ]]; then
  echo "Settings file not readable" >&2
  exit 1
fi
```

### Validate Frontmatter Structure

```bash
# The helper checks marker placement, YAML syntax, and mapping shape.
if ! "$PARSER" "$FILE" >/dev/null; then
  echo "Invalid settings file" >&2
  exit 1
fi
```

### Validate Field Values

```bash
MODE=$("$PARSER" "$FILE" mode)

case "$MODE" in
  strict|standard|lenient)
    # Valid mode
    ;;
  *)
    echo "Invalid mode: $MODE (must be strict, standard, or lenient)" >&2
    exit 1
    ;;
esac
```

### Validate Numeric Ranges

```bash
MAX_SIZE=$("$PARSER" "$FILE" max_size)

if ! [[ "$MAX_SIZE" =~ ^[0-9]+$ ]]; then
  echo "max_size must be a number" >&2
  exit 1
fi

if [[ $MAX_SIZE -lt 1 ]] || [[ $MAX_SIZE -gt 10000000 ]]; then
  echo "max_size out of range (1-10000000)" >&2
  exit 1
fi
```

## Edge Cases and Gotchas

### Quotes in Values

YAML allows both quoted and unquoted strings:

```yaml
# These are equivalent:
field1: value
field2: "value"
field3: 'value'
```

**Handle both:**
```bash
# Psych decodes either YAML string form.
VALUE=$("$PARSER" "$FILE" field)
```

### --- in Markdown Body

If the markdown body contains `---`, the parsing still works because we only match the first two:

```markdown
---
field: value
---

# Body

Here's a separator:
---

More content after the separator.
```

The body extractor above preserves this later horizontal rule.

### Empty Values

Handle missing or empty fields:

```yaml
field1:
field2: ""
field3: null
```

**Parsing:**
```bash
VALUE=$("$PARSER" "$FILE" field1 2>/dev/null || true)
# VALUE will be empty string

# Check for empty/null
if [[ -z "$VALUE" ]] || [[ "$VALUE" == "null" ]]; then
  VALUE="default"
fi
```

### Special Characters

Values with special characters need careful handling:

```yaml
message: "Error: Something went wrong!"
path: "/path/with spaces/file.txt"
regex: "^[a-zA-Z0-9_]+$"
```

**Safe parsing:**
```bash
# Always quote variables when using
MESSAGE=$("$PARSER" "$FILE" message)

echo "Message: $MESSAGE"  # Quoted!
```

## Performance Optimization

### Cache Values After Parsing

If reading settings multiple times:

```bash
# Parse once per required field, then reuse the shell variables.
FIELD1=$("$PARSER" "$FILE" field1)
FIELD2=$("$PARSER" "$FILE" field2)
FIELD3=$("$PARSER" "$FILE" field3)
```

**Don't:** Repeat these lookups inside a hot loop.

### Lazy Loading

Only parse settings when needed:

```bash
#!/bin/bash
input=$(cat)

# Quick checks first (no file I/O)
tool_name=$(echo "$input" | jq -r '.tool_name')
if [[ "$tool_name" != "Write" ]]; then
  exit 0  # Not a write operation, skip
fi

# Only now check settings file
if [[ -f ".claude/my-plugin.local.md" ]]; then
  # Parse settings
  # ...
fi
```

## Debugging

### Print Parsed Values

```bash
#!/bin/bash
set -x  # Enable debug tracing

FILE=".claude/my-plugin.local.md"

if [[ -f "$FILE" ]]; then
  echo "Settings file found" >&2

  FRONTMATTER=$("$PARSER" "$FILE")
  echo "Frontmatter:" >&2
  echo "$FRONTMATTER" >&2

  ENABLED=$("$PARSER" "$FILE" enabled)
  echo "Enabled: $ENABLED" >&2
fi
```

### Validate Parsing

```bash
# Show what was parsed
echo "Parsed values:" >&2
echo "  enabled: $ENABLED" >&2
echo "  mode: $MODE" >&2
echo "  max_size: $MAX_SIZE" >&2

# Verify expected values
if [[ "$ENABLED" != "true" ]] && [[ "$ENABLED" != "false" ]]; then
  echo "⚠️  Unexpected enabled value: $ENABLED" >&2
fi
```

## Alternative: Using yq

For complex YAML, consider using `yq`:

```bash
# Install: brew install yq

# Validate and extract the frontmatter before passing it to yq.
FRONTMATTER=$("$PARSER" "$FILE")

# Extract fields with yq
ENABLED=$(echo "$FRONTMATTER" | yq '.enabled')
MODE=$(echo "$FRONTMATTER" | yq '.mode')
LIST=$(echo "$FRONTMATTER" | yq -o json '.list_field')

# Iterate list properly
echo "$LIST" | jq -r '.[]' | while read -r item; do
  echo "Item: $item"
done
```

**Pros:**
- Proper YAML parsing
- Handles complex structures
- Better list/object support

**Cons:**
- Requires yq installation
- Additional dependency
- May not be available on all systems

**Recommendation:** Use `parse-frontmatter.sh` for scalar fields and its JSON
output with `jq` for lists/maps. Use `yq` only when you need more advanced YAML
queries.

## Complete Example

```bash
#!/bin/bash
set -euo pipefail

# Configuration
SETTINGS_FILE=".claude/my-plugin.local.md"
PARSER="${CLAUDE_PLUGIN_ROOT}/skills/plugin-settings/scripts/parse-frontmatter.sh"

# Quick exit if not configured
if [[ ! -f "$SETTINGS_FILE" ]]; then
  # Use defaults
  ENABLED=true
  MODE=standard
  MAX_SIZE=1000000
else
  # Extract fields with defaults
  ENABLED=$("$PARSER" "$SETTINGS_FILE" enabled 2>/dev/null || printf 'true')
  MODE=$("$PARSER" "$SETTINGS_FILE" mode 2>/dev/null || printf 'standard')
  MAX_SIZE=$("$PARSER" "$SETTINGS_FILE" max_size 2>/dev/null || printf '1000000')

  # Validate values
  if [[ "$ENABLED" != "true" ]] && [[ "$ENABLED" != "false" ]]; then
    echo "⚠️  Invalid enabled value, using default" >&2
    ENABLED=true
  fi

  if ! [[ "$MAX_SIZE" =~ ^[0-9]+$ ]]; then
    echo "⚠️  Invalid max_size, using default" >&2
    MAX_SIZE=1000000
  fi
fi

# Quick exit if disabled
if [[ "$ENABLED" != "true" ]]; then
  exit 0
fi

# Use configuration
echo "Configuration loaded: mode=$MODE, max_size=$MAX_SIZE" >&2

# Apply logic based on settings
case "$MODE" in
  strict)
    # Strict validation
    ;;
  standard)
    # Standard validation
    ;;
  lenient)
    # Lenient validation
    ;;
esac
```

This provides robust settings handling with defaults, validation, and error recovery.
