#!/usr/bin/env bash
# Claude Code Hooks Bug Reproduction Test
# Tests hooks functionality in subdirectories (Issue #8810 + #6305)

set -e

echo "🧪 Claude Code Hooks Bug Reproduction Test"
echo "=========================================="
echo ""

# Setup test directory structure
TEST_DIR="/tmp/claude-hooks-test-$$"
mkdir -p "$TEST_DIR/workspace/subdir"
cd "$TEST_DIR"

# Create hook script
mkdir -p "$TEST_DIR/workspace/subdir/.claude/hooks"
cat > "$TEST_DIR/workspace/subdir/.claude/hooks/test-hook.sh" <<'HOOK_EOF'
#!/usr/bin/env bash
read -r input_json
timestamp=$(date '+%Y-%m-%d %H:%M:%S')
echo "$timestamp - Hook executed!" >> /tmp/claude-hook-test.log
echo "🎬 Hook fired at $timestamp" >&2
exit 0
HOOK_EOF

chmod +x "$TEST_DIR/workspace/subdir/.claude/hooks/test-hook.sh"

# Test 1: Local settings.json (working directory)
echo "📝 Creating local .claude/settings.json..."
cat > "$TEST_DIR/workspace/subdir/.claude/settings.json" <<SETTINGS_EOF
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$TEST_DIR/workspace/subdir/.claude/hooks/test-hook.sh"
          }
        ]
      }
    ]
  }
}
SETTINGS_EOF

# Test 2: Global settings.json (backup existing)
echo "📝 Updating global ~/.claude/settings.json..."
mkdir -p ~/.claude

if [ -f ~/.claude/settings.json ]; then
  cp ~/.claude/settings.json ~/.claude/settings.json.backup-$(date +%s)
  echo "   ✅ Backed up existing settings to ~/.claude/settings.json.backup-$(date +%s)"
fi

cat > ~/.claude/settings.json <<GLOBAL_EOF
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$TEST_DIR/workspace/subdir/.claude/hooks/test-hook.sh"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cat > /dev/null && date '+SessionStart: %Y-%m-%d %H:%M:%S' >> /tmp/claude-hook-test.log"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cat > /dev/null && date '+Stop: %Y-%m-%d %H:%M:%S' >> /tmp/claude-hook-test.log"
          }
        ]
      }
    ]
  }
}
GLOBAL_EOF

# Clear test log
rm -f /tmp/claude-hook-test.log

echo ""
echo "✅ Test environment created!"
echo ""
echo "📁 Directories:"
echo "   Test root: $TEST_DIR"
echo "   Working dir (Claude launch from here): $TEST_DIR/workspace/subdir"
echo ""
echo "📄 Files:"
echo "   Hook script: $TEST_DIR/workspace/subdir/.claude/hooks/test-hook.sh"
echo "   Local settings: $TEST_DIR/workspace/subdir/.claude/settings.json"
echo "   Global settings: ~/.claude/settings.json (original backed up)"
echo "   Test log: /tmp/claude-hook-test.log"
echo ""
echo "🧪 Manual Hook Test:"
echo '   {"test": true}' | "$TEST_DIR/workspace/subdir/.claude/hooks/test-hook.sh" 2>&1

if [ -f /tmp/claude-hook-test.log ]; then
  echo "   ✅ Script works when run manually!"
  echo "   Log contents:"
  cat /tmp/claude-hook-test.log | sed 's/^/      /'
  rm -f /tmp/claude-hook-test.log  # Clear for actual test
else
  echo "   ❌ Script failed to create log"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 REPRODUCTION STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Launch Claude Code from the subdirectory:"
echo ""
echo "   cd $TEST_DIR/workspace/subdir"
echo "   claude --dangerously-skip-permissions"
echo ""
echo "2. Send any message to Claude (e.g., \"hello\")"
echo ""
echo "3. Ask Claude to check the hook log:"
echo ""
echo "   Check if hooks fired: cat /tmp/claude-hook-test.log"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 EXPECTED VS ACTUAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Expected (hooks working):"
echo "   SessionStart: 2025-10-26 08:30:15"
echo "   2025-10-26 08:30:16 - Hook executed! (UserPromptSubmit)"
echo "   2025-10-26 08:30:18 - Hook executed! (PreToolUse on Bash)"
echo "   Stop: 2025-10-26 08:30:19"
echo ""
echo "Actual (hooks broken in subdirectories):"
echo "   cat: /tmp/claude-hook-test.log: No such file or directory"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧹 CLEANUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "After testing, restore your original settings:"
echo ""
echo "   # Remove test environment"
echo "   rm -rf $TEST_DIR"
echo "   rm -f /tmp/claude-hook-test.log"
echo ""
echo "   # Restore original settings (if you had any)"
echo "   BACKUP=\$(ls -t ~/.claude/settings.json.backup-* 2>/dev/null | head -1)"
echo "   if [ -n \"\$BACKUP\" ]; then"
echo "     mv \"\$BACKUP\" ~/.claude/settings.json"
echo "     echo \"Restored: \$BACKUP\""
echo "   else"
echo "     rm ~/.claude/settings.json"
echo "     echo \"No backup found, removed test settings\""
echo "   fi"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Setup complete! Follow the reproduction steps above."
echo ""
