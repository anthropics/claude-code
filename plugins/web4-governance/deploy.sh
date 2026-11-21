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

# VERIFY BEFORE ADVERTISING. This script used to print a config pointing at
# $CLAUDE_PROJECT_DIR/web4/claude-code-plugin/hooks/ — a path that has not existed
# since the plugin moved to claude-code/plugins/web4-governance/. It printed it
# unconditionally and then said "Deployment complete". An operator who pasted it got
# a project whose settings.json names three hooks that are not there: Claude Code
# runs nothing, reports nothing, and the project reads as governed on every
# inventory. A dead hook is not a broken gate, it is an ABSENT one wearing a gate's
# name, which is worse than never having installed it.
MISSING=0
for h in session_start pre_tool_use post_tool_use; do
    if [[ ! -x "$SCRIPT_DIR/hooks/$h.py" ]]; then
        echo "  !! MISSING or not executable: $SCRIPT_DIR/hooks/$h.py"
        MISSING=1
    fi
done
if [[ $MISSING -eq 1 ]]; then
    echo ""
    echo "  Refusing to print a hook configuration for files that are not there."
    echo "  Fix the install before wiring anything to it."
    exit 1
fi

if [[ -f "$SCRIPT_DIR/hooks/hooks.json" ]]; then
    echo "This plugin ships hooks/hooks.json. If you installed it AS A PLUGIN,"
    echo "that manifest already wires these three hooks and you need no settings"
    echo "edit at all — adding them again double-fires every hook."
    echo ""
    echo "The block below is for a MANUAL (non-plugin) install only."
    echo ""
fi

echo "Add this to your project's .claude/settings.local.json:"
echo "(paths resolved from this checkout, so they are correct on THIS machine;"
echo " a different machine must re-run deploy.sh rather than copy them)"
echo ""
cat <<EOF
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$SCRIPT_DIR/hooks/session_start.py"
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
            "command": "$SCRIPT_DIR/hooks/pre_tool_use.py"
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
            "command": "$SCRIPT_DIR/hooks/post_tool_use.py"
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
