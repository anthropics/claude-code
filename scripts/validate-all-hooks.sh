#!/bin/bash
# Validate all hooks.json files in the repository
# This script can be run in CI to ensure all plugins have valid hook configurations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
VALIDATOR="$REPO_ROOT/plugins/plugin-dev/skills/hook-development/scripts/validate-hook-schema.sh"

echo "🔍 Validating all hooks.json files in the repository..."
echo ""

# Find all hooks.json files
mapfile -t HOOKS_FILES < <(find "$REPO_ROOT/plugins" -name "hooks.json" -type f 2>/dev/null)

if [ ${#HOOKS_FILES[@]} -eq 0 ]; then
  echo "No hooks.json files found"
  exit 0
fi

echo "Found ${#HOOKS_FILES[@]} hooks.json file(s)"
echo ""

errors=0
for hooks_file in "${HOOKS_FILES[@]}"; do
  relative_path="${hooks_file#$REPO_ROOT/}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📄 $relative_path"
  echo ""

  if bash "$VALIDATOR" "$hooks_file"; then
    echo ""
  else
    echo ""
    ((errors++))
  fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $errors -eq 0 ]; then
  echo "✅ All ${#HOOKS_FILES[@]} hooks.json file(s) are valid!"
  exit 0
else
  echo "❌ $errors hooks.json file(s) have validation errors"
  exit 1
fi
