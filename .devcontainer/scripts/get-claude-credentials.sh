#!/bin/bash
# Shared credential retrieval script
# Outputs JSON credentials or exits with error

# From https://github.com/textcortex/claude-code-sandbox/blob/main/src/credentials.ts
case "$(uname)" in
Darwin)
    # macOS: Use Keychain
    security find-generic-password \
        -s "Claude Code-credentials" \
        -a "$(whoami)" \
        -w 2>/dev/null || exit 1
    ;;
Linux)
    # Try ~/.claude/.credentials.json first (Claude Code standard location)
    if [[ -f "$HOME/.claude/.credentials.json" ]]; then
        cat "$HOME/.claude/.credentials.json" 2>/dev/null || exit 1
    # Try ~/.config/claude/auth.json (XDG config location)
    elif [[ -f "$HOME/.config/claude/auth.json" ]]; then
        cat "$HOME/.config/claude/auth.json" 2>/dev/null || exit 1
    else
        exit 1
    fi
    ;;
MINGW* | CYGWIN* | MSYS*)
    # TODO: Windows credential retrieval
    exit 1
    ;;
*)
    exit 1
    ;;
esac
