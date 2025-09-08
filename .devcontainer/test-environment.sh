#!/bin/bash

echo "🚀 Claude Code Advanced Environment Test"
echo "========================================"

echo "📋 Checking Node.js version..."
node --version

echo "📋 Checking Claude Code configuration..."
if [ -f ~/.claude/config.json ]; then
    echo "✅ Advanced Claude configuration found"
    echo "📊 Configuration summary:"
    if command -v jq >/dev/null 2>&1; then
        echo "   Experimental features: $(jq -r '.experimental.enabled' ~/.claude/config.json 2>/dev/null || echo 'unknown')"
        echo "   Alpha features: $(jq -r '.alpha.enabled' ~/.claude/config.json 2>/dev/null || echo 'unknown')"
        echo "   Beta features: $(jq -r '.beta.enabled' ~/.claude/config.json 2>/dev/null || echo 'unknown')"
    fi
else
    echo "⚠️  Claude configuration not found"
fi

echo "📋 Checking advanced tools..."
tools=("git" "delta" "exa" "bat" "rg" "fd" "fzf" "lazygit" "starship")
for tool in "${tools[@]}"; do
    if command -v "$tool" >/dev/null 2>&1; then
        echo "   ✅ $tool"
    else
        echo "   ❌ $tool (not installed)"
    fi
done

echo "📋 Environment variables..."
echo "   NODE_OPTIONS: ${NODE_OPTIONS:-not set}"
echo "   CLAUDE_EXPERIMENTAL_FEATURES: ${CLAUDE_EXPERIMENTAL_FEATURES:-not set}"
echo "   CLAUDE_ALPHA_FEATURES: ${CLAUDE_ALPHA_FEATURES:-not set}"
echo "   CLAUDE_BETA_FEATURES: ${CLAUDE_BETA_FEATURES:-not set}"

echo "📋 Git configuration..."
echo "   Default branch: $(git config --global init.defaultBranch || echo 'not set')"
echo "   Pager: $(git config --global core.pager || echo 'not set')"
echo "   Delta enabled: $(git config --global delta.navigate || echo 'not set')"

echo ""
echo "🎉 Environment test complete!"
echo "💡 Run 'claude --help' to see available commands"
echo "🔧 Run 'claude-config' to edit configuration"