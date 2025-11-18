#!/bin/bash
set -euo pipefail

# Setup script for test environment
# This script installs all test dependencies and sets up pre-commit hooks

echo "🔧 Setting up test environment for Claude Code..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✓ Node.js found: $(node --version)"

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Install bats helpers
echo "📦 Installing bats test helpers..."
mkdir -p tests/test_helper

if [ ! -d "tests/test_helper/bats-support" ]; then
    git clone https://github.com/bats-core/bats-support.git tests/test_helper/bats-support
    echo "✓ Installed bats-support"
else
    echo "✓ bats-support already installed"
fi

if [ ! -d "tests/test_helper/bats-assert" ]; then
    git clone https://github.com/bats-core/bats-assert.git tests/test_helper/bats-assert
    echo "✓ Installed bats-assert"
else
    echo "✓ bats-assert already installed"
fi

# Make shell scripts executable
echo "🔐 Making shell scripts executable..."
chmod +x .devcontainer/init-firewall.sh
chmod +x scripts/*.sh

# Install pre-commit (optional)
if command -v pre-commit &> /dev/null; then
    echo "📌 Installing pre-commit hooks..."
    pre-commit install
    echo "✓ Pre-commit hooks installed"
else
    echo "⚠️  pre-commit not found. To enable pre-commit hooks:"
    echo "   pip install pre-commit"
    echo "   pre-commit install"
fi

# Run a quick test to verify setup
echo ""
echo "🧪 Running quick test to verify setup..."
if npm run test:config; then
    echo ""
    echo "✅ Test environment setup complete!"
    echo ""
    echo "Available commands:"
    echo "  npm test           - Run all tests"
    echo "  npm run test:config - Run configuration tests"
    echo "  npm run test:shell  - Run shell script tests"
    echo "  npm run lint        - Run all linters"
    echo ""
    echo "See TESTING.md for detailed documentation."
else
    echo ""
    echo "⚠️  Some tests failed, but setup is complete."
    echo "Check the output above for details."
    exit 1
fi
