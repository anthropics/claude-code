#!/usr/bin/env bash
#
# Generate shell completion scripts for Claude Code CLI.
#
# Usage:
#   ./generate-completions.sh bash   # Print bash completions to stdout
#   ./generate-completions.sh zsh    # Print zsh completions to stdout
#   ./generate-completions.sh fish   # Print fish completions to stdout
#
# Installation:
#   # Bash — add to ~/.bashrc:
#   eval "$(claude completion bash)"
#
#   # Zsh — add to ~/.zshrc:
#   eval "$(claude completion zsh)"
#
#   # Fish — save to completions directory:
#   claude completion fish > ~/.config/fish/completions/claude.fish

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

generate_bash() {
  cat "${SCRIPT_DIR}/claude.bash"
}

generate_zsh() {
  cat "${SCRIPT_DIR}/claude.zsh"
}

generate_fish() {
  cat "${SCRIPT_DIR}/claude.fish"
}

case "${1:-}" in
  bash)
    generate_bash
    ;;
  zsh)
    generate_zsh
    ;;
  fish)
    generate_fish
    ;;
  *)
    echo "Usage: $(basename "$0") <bash|zsh|fish>" >&2
    echo "" >&2
    echo "Generate shell completion scripts for Claude Code CLI." >&2
    echo "" >&2
    echo "Installation:" >&2
    echo "  # Bash — add to ~/.bashrc:" >&2
    echo '  eval "$(claude completion bash)"' >&2
    echo "" >&2
    echo "  # Zsh — add to ~/.zshrc:" >&2
    echo '  eval "$(claude completion zsh)"' >&2
    echo "" >&2
    echo "  # Fish — save to completions directory:" >&2
    echo "  claude completion fish > ~/.config/fish/completions/claude.fish" >&2
    exit 1
    ;;
esac
