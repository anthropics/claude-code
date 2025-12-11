#!/bin/bash
# Session start hook for claude-md-includes plugin
# Calls the Python processor to expand @include directives in CLAUDE.md

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"

# Run the Python processor
python3 "$PLUGIN_ROOT/scripts/process-includes.py"
