#!/usr/bin/env bash
# Setup script for installing bats-core and dependencies

set -euo pipefail

echo "Installing test dependencies..."

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  echo "Detected Linux system"

  # Install via apt if available
  if command -v apt-get >/dev/null 2>&1; then
    echo "Installing via apt-get..."
    sudo apt-get update
    sudo apt-get install -y bats shellcheck jq curl

  # Install via yum if available
  elif command -v yum >/dev/null 2>&1; then
    echo "Installing via yum..."
    sudo yum install -y bats shellcheck jq curl

  else
    echo "No supported package manager found. Installing bats-core manually..."

    # Install bats-core from source
    git clone https://github.com/bats-core/bats-core.git /tmp/bats-core
    cd /tmp/bats-core
    sudo ./install.sh /usr/local
    cd -
    rm -rf /tmp/bats-core
  fi

elif [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Detected macOS"

  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew not found. Please install Homebrew first:"
    echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    exit 1
  fi

  echo "Installing via Homebrew..."
  brew install bats-core shellcheck jq

else
  echo "Unsupported operating system: $OSTYPE"
  exit 1
fi

# Verify installations
echo ""
echo "Verifying installations..."

if command -v bats >/dev/null 2>&1; then
  echo "✓ bats-core installed: $(bats --version)"
else
  echo "✗ bats-core installation failed"
  exit 1
fi

if command -v shellcheck >/dev/null 2>&1; then
  echo "✓ shellcheck installed: $(shellcheck --version | head -1)"
else
  echo "✗ shellcheck installation failed"
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  echo "✓ jq installed: $(jq --version)"
else
  echo "✗ jq installation failed"
  exit 1
fi

echo ""
echo "All test dependencies installed successfully!"
echo ""
echo "You can now run tests with:"
echo "  bats tests/**/*.bats              # Run all tests"
echo "  bats tests/unit/**/*.bats         # Run unit tests only"
echo "  bats tests/integration/**/*.bats  # Run integration tests only"
echo "  npm test                          # Run via npm script"
