#!/usr/bin/env bash
# syntax-check.sh — PostToolUse hook for Edit/Write
#
# After editing TypeScript/JavaScript files, runs a quick syntax check
# so errors are caught immediately rather than 50 tool calls later.
#
# Copyright 2026 Stackbilt LLC — Apache 2.0

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)

if [[ "$TOOL" != "Edit" && "$TOOL" != "Write" ]]; then
  exit 0
fi

FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Only check TypeScript/JavaScript files
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx)
    # Find nearest tsconfig
    DIR=$(dirname "$FILE")
    TSCONFIG=""
    while [[ "$DIR" != "/" && "$DIR" != "." ]]; do
      if [[ -f "${DIR}/tsconfig.json" ]]; then
        TSCONFIG="${DIR}/tsconfig.json"
        break
      fi
      DIR=$(dirname "$DIR")
    done

    if [[ -n "$TSCONFIG" ]]; then
      ERRORS=$(cd "$(dirname "$TSCONFIG")" && npx tsc --noEmit --pretty false 2>&1 | grep -c "error TS" || true)
      if [[ "$ERRORS" -gt 0 ]]; then
        echo "WARNING: ${ERRORS} TypeScript error(s) detected after editing ${FILE}. Run typecheck to see details." >&2
      fi
    fi
    ;;
esac

# Never block — advisory only
exit 0
