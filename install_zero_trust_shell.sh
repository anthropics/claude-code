#!/bin/bash
# Zero-Trust Shell Wrapper Installation Script
# Addresses GitHub Issue #2695: Zero-Trust Architecture for Environment Variable Security

set -euo pipefail

echo "Shell Wrapper Installation for Issue #2695"
echo "============================================"
echo "Installing shell-level secret detection for Claude Code"
echo

# Configuration
INSTALL_DIR="/usr/local/bin"
SCRIPT_NAME="claude-code-shell"
AUDIT_DIR="$HOME/.claude-code-security"
WRAPPER_SCRIPT="zero_trust_shell_complete.sh"

# Check if running as root for system installation
if [[ $EUID -eq 0 ]]; then
    echo "⚠️  Running as root - installing system-wide"
    INSTALL_PATH="$INSTALL_DIR/$SCRIPT_NAME"
else
    echo "📁 Installing to user directory"
    INSTALL_DIR="$HOME/.local/bin"
    INSTALL_PATH="$INSTALL_DIR/$SCRIPT_NAME"
    mkdir -p "$INSTALL_DIR"
fi

# Verify wrapper script exists
if [[ ! -f "$WRAPPER_SCRIPT" ]]; then
    echo "❌ ERROR: $WRAPPER_SCRIPT not found in current directory"
    echo "Please run this script from the directory containing $WRAPPER_SCRIPT"
    exit 1
fi

# Create audit directory
echo "📂 Creating audit directory..."
mkdir -p "$AUDIT_DIR"
chmod 700 "$AUDIT_DIR"

# Install wrapper script
echo "🔧 Installing wrapper script to $INSTALL_PATH..."
cp "$WRAPPER_SCRIPT" "$INSTALL_PATH"
chmod +x "$INSTALL_PATH"

# Verify installation
if [[ -x "$INSTALL_PATH" ]]; then
    echo "✅ Installation successful!"
else
    echo "❌ Installation failed - $INSTALL_PATH not executable"
    exit 1
fi

# Create configuration
echo "⚙️  Creating configuration..."
cat > "$AUDIT_DIR/config.env" << EOF
# Zero-Trust Shell Wrapper Configuration
export CLAUDE_CODE_AUDIT_FILE="$AUDIT_DIR/audit.jsonl"
export CLAUDE_CODE_LOG_LEVEL="INFO"
export CLAUDE_CODE_ENABLE_MASKING="true"
EOF

# Add to shell profile
SHELL_PROFILE=""
if [[ -f "$HOME/.bashrc" ]]; then
    SHELL_PROFILE="$HOME/.bashrc"
elif [[ -f "$HOME/.zshrc" ]]; then
    SHELL_PROFILE="$HOME/.zshrc"
elif [[ -f "$HOME/.profile" ]]; then
    SHELL_PROFILE="$HOME/.profile"
fi

if [[ -n "$SHELL_PROFILE" ]]; then
    echo "🐚 Adding configuration to $SHELL_PROFILE..."
    
    # Check if already configured
    if ! grep -q "Claude Code Zero-Trust" "$SHELL_PROFILE"; then
        cat >> "$SHELL_PROFILE" << EOF

# Claude Code Zero-Trust Shell Wrapper (Issue #2695)
if [[ -f "$AUDIT_DIR/config.env" ]]; then
    source "$AUDIT_DIR/config.env"
fi
export CLAUDE_CODE_SHELL="$INSTALL_PATH"
EOF
        echo "✅ Configuration added to $SHELL_PROFILE"
        echo "📋 Run 'source $SHELL_PROFILE' or restart your shell to activate"
    else
        echo "ℹ️  Configuration already exists in $SHELL_PROFILE"
    fi
fi

# Run verification test
echo
echo "🧪 Running verification test..."
TEST_API_KEY="sk-test123456789012345678901234567890123456789" \
CLAUDE_CODE_AUDIT_FILE="$AUDIT_DIR/test-audit.jsonl" \
"$INSTALL_PATH" -c 'echo $TEST_API_KEY' > /tmp/test_output 2>&1

if grep -q "MASKED_OPENAI_API_KEY" /tmp/test_output; then
    echo "✅ Verification test PASSED - secrets are being masked!"
    echo "🔍 Test output:"
    cat /tmp/test_output | grep "🔒"
else
    echo "❌ Verification test FAILED"
    echo "🔍 Test output:"
    cat /tmp/test_output
    exit 1
fi

# Cleanup test files
rm -f /tmp/test_output "$AUDIT_DIR/test-audit.jsonl"

echo
echo "🎉 Installation Complete!"
echo "========================"
echo "📍 Wrapper installed at: $INSTALL_PATH"
echo "📂 Audit directory: $AUDIT_DIR"
echo "📋 Configuration: $AUDIT_DIR/config.env"
echo
echo "🔧 Next Steps:"
echo "1. Restart your shell or run: source $SHELL_PROFILE"
echo "2. Verify Claude Code uses the wrapper for shell execution"
echo "3. Monitor audit trail: tail -f $AUDIT_DIR/audit.jsonl"
echo
echo "🧪 Test the installation:"
echo "export TEST_SECRET=\"sk-test123\" && echo \$TEST_SECRET"
echo
echo "This installation addresses GitHub Issue #2695 by providing"
echo "client-side secret detection for environment variable protection."