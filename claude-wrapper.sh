#!/bin/bash
# Wrapper für den claude-Befehl, der die Node.js-Optionen korrekt setzt

NODE_OPTIONS="--max-old-space-size=4096" node --no-warnings --enable-source-maps /usr/local/share/npm-global/lib/node_modules/@anthropic-ai/claude-code/cli.js "$@"
