#!/bin/bash
# generate-report.sh - Stop hook to generate quality report summary

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

REPORT_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/reports"
mkdir -p "$REPORT_DIR"

REPORT_FILE="$REPORT_DIR/quality-report-$(date +%Y%m%d-%H%M%S).md"

# Generate report header
cat > "$REPORT_FILE" << EOF
# Code Quality Report

**Generated:** $TIMESTAMP
**Session:** $SESSION_ID

## Summary

EOF

# Add git info if available
if git rev-parse --git-dir &>/dev/null; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
    COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    cat >> "$REPORT_FILE" << EOF
### Repository
- Branch: \`$BRANCH\`
- Commit: \`$COMMIT\`
- Remote: \`$(git remote get-url origin 2>/dev/null || echo "none")\`

EOF
fi

# Count files by type
if command -v find &>/dev/null; then
    PY_COUNT=$(find . -name "*.py" -type f 2>/dev/null | wc -l)
    RS_COUNT=$(find . -name "*.rs" -type f 2>/dev/null | wc -l)
    JS_COUNT=$(find . -name "*.js" -o -name "*.ts" -type f 2>/dev/null | wc -l)

    cat >> "$REPORT_FILE" << EOF
### File Counts
| Language | Files |
|----------|-------|
| Python   | $PY_COUNT |
| Rust     | $RS_COUNT |
| JS/TS    | $JS_COUNT |

EOF
fi

echo "Quality report saved to: $REPORT_FILE"
exit 0
