#!/bin/bash
set -euo pipefail

# Setup script for test dependencies
# This script installs all required tools for running the test suite

echo "==================================="
echo "Claude Code - Test Setup"
echo "==================================="
echo ""

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OS="linux"
  PKG_MANAGER="apt-get"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
  PKG_MANAGER="brew"
else
  echo "Unsupported OS: $OSTYPE"
  exit 1
fi

echo "Detected OS: $OS"
echo ""

# Install bats
echo "Installing bats (Bash Automated Testing System)..."
if command -v bats &> /dev/null; then
  echo "✓ bats already installed: $(bats --version)"
else
  if [ "$OS" == "linux" ]; then
    sudo apt-get update
    sudo apt-get install -y bats
  else
    brew install bats-core
  fi
  echo "✓ bats installed successfully"
fi
echo ""

# Install shellcheck
echo "Installing shellcheck (Shell script linter)..."
if command -v shellcheck &> /dev/null; then
  echo "✓ shellcheck already installed: $(shellcheck --version | head -n 2 | tail -n 1)"
else
  if [ "$OS" == "linux" ]; then
    sudo apt-get install -y shellcheck
  else
    brew install shellcheck
  fi
  echo "✓ shellcheck installed successfully"
fi
echo ""

# Install actionlint
echo "Installing actionlint (GitHub Actions linter)..."
if command -v actionlint &> /dev/null; then
  echo "✓ actionlint already installed: $(actionlint --version)"
else
  bash <(curl https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)
  if [ "$OS" == "linux" ]; then
    sudo mv ./actionlint /usr/local/bin/
  fi
  echo "✓ actionlint installed successfully"
fi
echo ""

# Install act (optional)
echo "Installing act (Run GitHub Actions locally)..."
if command -v act &> /dev/null; then
  echo "✓ act already installed: $(act --version)"
else
  echo "Would you like to install act? (y/n)"
  read -r response
  if [[ "$response" =~ ^[Yy]$ ]]; then
    if [ "$OS" == "linux" ]; then
      curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
    else
      brew install act
    fi
    echo "✓ act installed successfully"
  else
    echo "⊘ Skipping act installation"
  fi
fi
echo ""

# Install Node.js dependencies (if package.json exists)
if [ -f "package.json" ]; then
  echo "Installing Node.js dependencies..."
  if command -v npm &> /dev/null; then
    npm install
    echo "✓ Node.js dependencies installed"
  else
    echo "⚠ npm not found, skipping Node.js dependencies"
  fi
  echo ""
fi

# Verify installations
echo "==================================="
echo "Verifying installations..."
echo "==================================="
echo ""

all_installed=true

if command -v bats &> /dev/null; then
  echo "✓ bats: $(bats --version)"
else
  echo "✗ bats: NOT INSTALLED"
  all_installed=false
fi

if command -v shellcheck &> /dev/null; then
  echo "✓ shellcheck: $(shellcheck --version | head -n 2 | tail -n 1)"
else
  echo "✗ shellcheck: NOT INSTALLED"
  all_installed=false
fi

if command -v actionlint &> /dev/null; then
  echo "✓ actionlint: $(actionlint --version)"
else
  echo "✗ actionlint: NOT INSTALLED"
  all_installed=false
fi

if command -v act &> /dev/null; then
  echo "✓ act: $(act --version)"
else
  echo "⊘ act: NOT INSTALLED (optional)"
fi

echo ""

if [ "$all_installed" = true ]; then
  echo "==================================="
  echo "✓ Setup complete!"
  echo "==================================="
  echo ""
  echo "You can now run tests with:"
  echo "  npm test                 # Run all tests"
  echo "  npm run test:lint        # Run linters only"
  echo "  npm run test:bats        # Run bats tests only"
  echo "  bats tests/**/*.bats     # Run specific test files"
  echo ""
else
  echo "==================================="
  echo "⚠ Setup incomplete"
  echo "==================================="
  echo "Some tools failed to install. Please check the errors above."
  exit 1
fi
