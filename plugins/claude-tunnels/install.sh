#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$SCRIPT_DIR/skills"

echo "======================================"
echo "  Claude-Code-Tunnels Installer"
echo "======================================"
echo ""

# Step 1: Install Python dependencies
echo "[1/3] Installing Python dependencies..."
pip install claude-agent-sdk aiohttp pyyaml 2>/dev/null || {
    echo "  pip install failed. Please install manually:"
    echo "    pip install claude-agent-sdk aiohttp pyyaml"
}

# Step 2: Install skill files
echo "[2/3] Installing skill files..."

CLAUDE_COMMANDS_DIR="$HOME/.claude/commands"
mkdir -p "$CLAUDE_COMMANDS_DIR"

for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")
    target_dir="$CLAUDE_COMMANDS_DIR/$skill_name"

    if [ -d "$target_dir" ]; then
        echo "  Skill '$skill_name' already exists, skipping"
    else
        mkdir -p "$target_dir"
        cp -r "$skill_dir"* "$target_dir/"
        echo "  Installed: /$skill_name"
    fi
done

# Step 3: Verify
echo "[3/3] Verifying installation..."

if python3 -c "import claude_agent_sdk" 2>/dev/null; then
    echo "  claude-agent-sdk: OK"
else
    echo "  claude-agent-sdk: NOT FOUND (install with: pip install claude-agent-sdk)"
fi

if python3 -c "import aiohttp" 2>/dev/null; then
    echo "  aiohttp: OK"
else
    echo "  aiohttp: NOT FOUND"
fi

if python3 -c "import yaml" 2>/dev/null; then
    echo "  pyyaml: OK"
else
    echo "  pyyaml: NOT FOUND"
fi

echo ""
echo "======================================"
echo "  Installation complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. cd to your project root directory"
echo "  2. Run: /setup-orchestrator"
echo "  3. Follow the interactive setup wizard"
echo ""
echo "Or manually:"
echo "  1. Copy orchestrator/ to your project root"
echo "  2. Edit orchestrator.yaml with your paths"
echo "  3. Run: ./start-orchestrator.sh"
echo ""
