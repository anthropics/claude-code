#!/bin/bash
# Deploy web4 governance plugin for Claude Code
# Run this on each machine in the collective

set -e

echo "=== Web4 Governance Plugin Deployment ==="
echo ""

# Step 1: Create ~/.web4 directory structure
echo "[1/3] Creating ~/.web4 directory..."
mkdir -p ~/.web4/sessions ~/.web4/r6 ~/.web4/audit
chmod 700 ~/.web4

# Step 2: Create default preferences
echo "[2/3] Creating preferences..."
if [[ ! -f ~/.web4/preferences.json ]]; then
    cat > ~/.web4/preferences.json << 'EOF'
{
  "audit_level": "standard",
  "show_r6_status": true,
  "action_budget": null
}
EOF
    echo "  Created ~/.web4/preferences.json"
else
    echo "  Preferences already exist, skipping"
fi

# Step 3: Make hooks executable
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "[3/3] Making hooks executable..."
chmod +x "$SCRIPT_DIR/hooks/"*.py
echo "  Done"

echo ""
echo "=== Hook Configuration ==="
echo ""
echo "Add this to your project's .claude/settings.local.json:"
echo "(Uses \$CLAUDE_PROJECT_DIR for portability across machines)"
echo ""
cat << 'EOF'
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/web4/claude-code-plugin/hooks/session_start.py"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/web4/claude-code-plugin/hooks/pre_tool_use.py"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/web4/claude-code-plugin/hooks/post_tool_use.py"
          }
        ]
      }
    ]
  }
}
EOF

echo ""
echo "=== Deployment complete ==="
echo ""
echo "Next steps:"
echo "1. Add the hook configuration above to .claude/settings.local.json"
echo "2. Restart Claude Code"
echo "3. Check ~/.web4/sessions/ for session state files"
echo ""
echo "Audit trail location:"
echo "  Sessions: ~/.web4/sessions/"
echo "  R6 Requests: ~/.web4/r6/"
echo "  Audit Records: ~/.web4/audit/"
