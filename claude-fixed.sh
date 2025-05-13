#!/bin/bash
# Wrapper script for the claude command with fixed NODE_OPTIONS

# Unset NODE_OPTIONS to avoid any issues
unset NODE_OPTIONS

# Set a clean NODE_OPTIONS value
export NODE_OPTIONS="--max-old-space-size=4096"

# Run the claude command
/usr/local/share/npm-global/lib/node_modules/@anthropic-ai/claude-code/cli.js "$@"
