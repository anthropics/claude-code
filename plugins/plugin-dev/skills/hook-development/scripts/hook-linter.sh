#!/bin/bash
# Hook Linter
# Checks hook scripts for common issues and best practices

set -euo pipefail

# Usage
if [ $# -eq 0 ]; then
  echo "Usage: $0 <hook-script.sh> [hook-script2.sh ...]"
  echo ""
  echo "Checks hook scripts for:"
  echo "  - Shebang presence"
  echo "  - set -euo pipefail usage"
  echo "  - Input reading from stdin"
  echo "  - Proper error handling"
  echo "  - Variable quoting"
  echo "  - Exit code usage"
  echo "  - Hardcoded paths"
  echo "  - Timeout considerations"
  exit 1
fi

check_script() {
  local script="$1"
  local warnings=0
  local errors=0

  echo "🔍 Linting: $script"
  echo ""

  if [ ! -f "$script" ]; then
    echo "❌ Error: File not found"
    return 1
  fi

  # Check 1: Executable
  if [ ! -x "$script" ]; then
    echo "⚠️  Not executable (chmod +x $script)"
    ((warnings++))
  fi

  # Check 2: Shebang
  first_line=$(head -1 "$script")
  if [[ ! "$first_line" =~ ^#!/ ]]; then
    echo "❌ Missing shebang (#!/bin/bash)"
    ((errors++))
  fi

  # Check 3: set -euo pipefail
  if ! grep -q "set -euo pipefail" "$script"; then
    echo "⚠️  Missing 'set -euo pipefail' (recommended for safety)"
    ((warnings++))
  fi

  # Check 4: Reads from stdin
  if ! grep -q "cat\|read" "$script"; then
    echo "⚠️  Doesn't appear to read input from stdin"
    ((warnings++))
  fi

  # Check 5: Uses jq for JSON parsing
  if grep -q "tool_input\|tool_name" "$script" && ! grep -q "jq" "$script"; then
    echo "⚠️  Parses hook input but doesn't use jq"
    ((warnings++))
  fi

  # Check 6: Unquoted variables
  if grep -E '\$[A-Za-z_][A-Za-z0-9_]*[^"]' "$script" | grep -v '#' | grep -q .; then
    echo "⚠️  Potentially unquoted variables detected (injection risk)"
    echo "   Always use double quotes: \"\$variable\" not \$variable"
    ((warnings++))
  fi

  # Check 7: Hardcoded paths
  if grep -E '^[^#]*/home/|^[^#]*/usr/|^[^#]*/opt/' "$script" | grep -q .; then
    echo "⚠️  Hardcoded absolute paths detected"
    echo "   Use \$CLAUDE_PROJECT_DIR or \$CLAUDE_PLUGIN_ROOT"
    ((warnings++))
  fi

  # Check 8: Uses CLAUDE_PLUGIN_ROOT
  if ! grep -q "CLAUDE_PLUGIN_ROOT\|CLAUDE_PROJECT_DIR" "$script"; then
    echo "💡 Tip: Use \$CLAUDE_PLUGIN_ROOT for plugin-relative paths"
  fi

  # Check 9: Exit codes
  if ! grep -q "exit 0\|exit 2" "$script"; then
    echo "⚠️  No explicit exit codes (should exit 0 or 2)"
    ((warnings++))
  fi

  # Check 10: JSON output for decision hooks
  if grep -q "PreToolUse\|Stop" "$script"; then
    if ! grep -q "permissionDecision\|decision" "$script"; then
      echo "💡 Tip: PreToolUse/Stop hooks should output decision JSON"
    fi
  fi

  # Check 11: Long-running commands
  if grep -E 'sleep [0-9]{3,}|while true' "$script" | grep -v '#' | grep -q .; then
    echo "⚠️  Potentially long-running code detected"
    echo "   Hooks should complete quickly (< 60s)"
    ((warnings++))
  fi

  # Check 12: Error messages to stderr
  if grep -q 'echo.*".*error\|Error\|denied\|Denied' "$script"; then
    if ! grep -q '>&2' "$script"; then
      echo "⚠️  Error messages should be written to stderr (>&2)"
      ((warnings++))
    fi
  fi

  # Check 13: Input validation
  if ! grep -q "if.*empty\|if.*null\|if.*-z" "$script"; then
    echo "💡 Tip: Consider validating input fields aren't empty"
  fi

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
    echo "✅ No issues found"
    return 0
  elif [ $errors -eq 0 ]; then
    echo "⚠️  Found $warnings warning(s)"
    return 0
  else
    echo "❌ Found $errors error(s) and $warnings warning(s)"
    return 1
  fi
}

echo "🔎 Hook Script Linter"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

total_errors=0

for script in "$@"; do
  if ! check_script "$script"; then
    ((total_errors++))
  fi
  echo ""
done

if [ $total_errors -eq 0 ]; then
  echo "✅ All scripts passed linting"
  exit 0
else
  echo "❌ $total_errors script(s) had errors"
  exit 1
fi
