#!/bin/bash
# Wrapper für den claude-Befehl, der die Node.js-Optionen korrekt setzt

# Use existing NODE_OPTIONS if set, otherwise set a default
if [ -z "$NODE_OPTIONS" ]; then
  export NODE_OPTIONS="--max-old-space-size=4096"
fi

node --no-warnings --enable-source-maps /usr/local/share/npm-global/lib/node_modules/@anthropic-ai/claude-code/cli.js "$@"
