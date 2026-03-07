#!/usr/bin/env bash
# termux-setup.sh — Set up Claude Code for Termux/Android
#
# This script configures the environment for running Claude Code on Termux,
# where /tmp is not writable by non-root users.
#
# What it does:
#   1. Creates the necessary temp directories under $TMPDIR
#   2. Adds CLAUDE_CODE_TMPDIR to your shell profile
#   3. Optionally patches cli.js to fix hardcoded /tmp paths
#
# Usage:
#   bash scripts/termux-setup.sh
#
# Related issues:
#   https://github.com/anthropics/claude-code/issues/15637
#   https://github.com/anthropics/claude-code/issues/18342

set -euo pipefail

echo "Claude Code — Termux/Android Setup"
echo "===================================="
echo ""

# Check if running on Termux
if [ -z "${TERMUX_VERSION:-}" ] && [ ! -d "/data/data/com.termux" ]; then
    echo "Warning: This does not appear to be a Termux environment."
    echo "This script is designed for Termux on Android."
    echo ""
    read -rp "Continue anyway? (y/N) " answer
    if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
        exit 0
    fi
fi

# Determine the correct TMPDIR
if [ -n "${TMPDIR:-}" ]; then
    BASE_TMPDIR="$TMPDIR"
elif [ -n "${PREFIX:-}" ]; then
    BASE_TMPDIR="$PREFIX/tmp"
else
    BASE_TMPDIR="/data/data/com.termux/files/usr/tmp"
fi

CLAUDE_TMPDIR="$BASE_TMPDIR"

echo "System TMPDIR: $BASE_TMPDIR"
echo "Claude TMPDIR: $CLAUDE_TMPDIR"
echo ""

# Step 1: Create necessary directories
echo "Step 1: Creating temp directories..."
mkdir -p "$CLAUDE_TMPDIR/claude" 2>/dev/null || true

if [ -d "$CLAUDE_TMPDIR/claude" ]; then
    echo "  [OK] $CLAUDE_TMPDIR/claude"
else
    echo "  [ERROR] Failed to create $CLAUDE_TMPDIR/claude"
    echo "  Check permissions on $CLAUDE_TMPDIR"
    exit 1
fi

# Step 2: Set up environment variables in shell profile
echo ""
echo "Step 2: Configuring environment variables..."

EXPORT_LINE="export CLAUDE_CODE_TMPDIR=\"$CLAUDE_TMPDIR\""

# Detect shell profile
SHELL_NAME="$(basename "${SHELL:-bash}")"
case "$SHELL_NAME" in
    zsh)  PROFILE="$HOME/.zshrc" ;;
    bash) PROFILE="$HOME/.bashrc" ;;
    *)    PROFILE="$HOME/.profile" ;;
esac

if [ -f "$PROFILE" ] && grep -qF "CLAUDE_CODE_TMPDIR" "$PROFILE"; then
    echo "  [SKIP] CLAUDE_CODE_TMPDIR already set in $PROFILE"
else
    echo "" >> "$PROFILE"
    echo "# Claude Code — use Termux-compatible temp directory" >> "$PROFILE"
    echo "$EXPORT_LINE" >> "$PROFILE"
    echo "  [OK] Added to $PROFILE:"
    echo "       $EXPORT_LINE"
fi

# Set it for the current session too
export CLAUDE_CODE_TMPDIR="$CLAUDE_TMPDIR"

# Step 3: Optionally run the patch script
echo ""
echo "Step 3: Patching cli.js..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_SCRIPT="$SCRIPT_DIR/patch-tmp-paths.sh"

if [ -f "$PATCH_SCRIPT" ]; then
    bash "$PATCH_SCRIPT" "${1:-}" || echo "  [WARN] Patch script encountered issues (see above)"
else
    echo "  [SKIP] patch-tmp-paths.sh not found at $PATCH_SCRIPT"
    echo "         The environment variable workaround should still help."
fi

echo ""
echo "===================================="
echo "Setup complete!"
echo ""
echo "To apply changes to your current session, run:"
echo "  source $PROFILE"
echo ""
echo "Then start Claude Code normally:"
echo "  claude"
