#!/bin/bash
# Session start hook for claude-md-includes plugin
# Calls the Python processor to expand @include directives in CLAUDE.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
PYTHON_SCRIPT="$PLUGIN_ROOT/scripts/process-includes.py"

# Verify the Python script exists
if [[ ! -f "$PYTHON_SCRIPT" ]]; then
    echo "Error: Python script not found: $PYTHON_SCRIPT" >&2
    exit 1
fi

# Run the Python processor
if ! python3 "$PYTHON_SCRIPT"; then
    echo "Error: Python processor failed" >&2
    exit 1
fi
