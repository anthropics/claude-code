#!/bin/bash
# setup-tools.sh - Install and verify code quality tools at session start
# Exit codes: 0 = success, 2 = blocking error (feedback to Claude)

set -e

TOOLS_STATUS=""
MISSING_TOOLS=()

check_tool() {
    local tool="$1"
    local install_cmd="$2"
    if command -v "$tool" &>/dev/null; then
        TOOLS_STATUS="${TOOLS_STATUS}✓ $tool available\n"
    else
        MISSING_TOOLS+=("$tool")
        TOOLS_STATUS="${TOOLS_STATUS}✗ $tool not found (install: $install_cmd)\n"
    fi
}

# Core tools
check_tool "git" "apt install git"
check_tool "jq" "apt install jq"

# Python tools
check_tool "python3" "apt install python3"
check_tool "ruff" "pip install ruff"
check_tool "mypy" "pip install mypy"

# Rust tools
check_tool "cargo" "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"

# JavaScript tools
check_tool "node" "apt install nodejs"
check_tool "npm" "apt install npm"

# Documentation tools
check_tool "doxygen" "apt install doxygen"

# Spelling tools
check_tool "codespell" "pip install codespell"

# Try to install missing Python tools quietly
if command -v pip3 &>/dev/null; then
    pip3 install --quiet --user ruff mypy codespell pydantic 2>/dev/null || true
fi

# Try to install missing npm tools
if command -v npm &>/dev/null; then
    npm install --quiet --global jshint eslint prettier 2>/dev/null || true
fi

# Set up environment variables if CLAUDE_ENV_FILE is available
if [ -n "$CLAUDE_ENV_FILE" ]; then
    {
        echo 'export PATH="$PATH:$HOME/.local/bin:./node_modules/.bin"'
        echo 'export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}."'
        echo 'export REPO_QUALITY_ENABLED=true'
    } >> "$CLAUDE_ENV_FILE"
fi

# Output status for verbose mode
echo -e "$TOOLS_STATUS"

# If critical tools are missing, return blocking error
CRITICAL_MISSING=()
for tool in git jq python3; do
    if ! command -v "$tool" &>/dev/null; then
        CRITICAL_MISSING+=("$tool")
    fi
done

if [ ${#CRITICAL_MISSING[@]} -gt 0 ]; then
    echo "Critical tools missing: ${CRITICAL_MISSING[*]}" >&2
    exit 2
fi

exit 0
