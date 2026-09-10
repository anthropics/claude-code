#!/usr/bin/env bash
# check-update.sh — Detects how Claude Code was installed and checks
# the correct version source.  Reports whether the built-in "Update
# available!" banner is accurate or a false positive caused by
# npm-vs-package-manager version lag.
#
# Runs as a SessionStart hook.  Output is a JSON object with
# hookSpecificOutput.hookEventName = "SessionStart" and additionalContext
# containing the result.

set -euo pipefail

installed_version=$(claude --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)

if [ -z "$installed_version" ]; then
  # Cannot determine version — skip silently.
  exit 0
fi

# --- Detect installation method ---
install_method="unknown"
available_version=""

detect_brew() {
  if ! command -v brew >/dev/null 2>&1; then return 1; fi
  local info
  info=$(brew info --cask claude-code 2>/dev/null) || return 1
  # Homebrew cask output format: "==> claude-code (Claude Code): 2.1.118"
  available_version=$(echo "$info" | grep -iE 'claude-code.*: [0-9]' | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
  if [ -n "$available_version" ]; then
    install_method="homebrew"
    return 0
  fi
  return 1
}

detect_winget() {
  if ! command -v winget.exe >/dev/null 2>&1 && ! command -v winget >/dev/null 2>&1; then return 1; fi
  local winget_cmd
  winget_cmd=$(command -v winget.exe 2>/dev/null || command -v winget 2>/dev/null)
  local info
  info=$($winget_cmd show Anthropic.ClaudeCode --accept-source-agreements 2>/dev/null) || return 1
  available_version=$(echo "$info" | grep -iE '^Version' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
  if [ -n "$available_version" ]; then
    install_method="winget"
    return 0
  fi
  return 1
}

detect_npm() {
  if ! command -v npm >/dev/null 2>&1; then return 1; fi
  local info
  info=$(npm view @anthropic-ai/claude-code version 2>/dev/null) || return 1
  available_version=$(echo "$info" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
  if [ -n "$available_version" ]; then
    install_method="npm"
    return 0
  fi
  return 1
}

# Try each detection method in order of likelihood.
detect_brew || detect_winget || detect_npm || true

if [ -z "$available_version" ] || [ "$install_method" = "unknown" ]; then
  # Could not determine package source — skip silently.
  exit 0
fi

# --- Compare versions ---
# Simple lexicographic comparison works for semver with equal-length segments.
# For robustness, compare each segment numerically.
version_gt() {
  local IFS=.
  local i a=($1) b=($2)
  for ((i = 0; i < ${#a[@]}; i++)); do
    local va=${a[i]:-0}
    local vb=${b[i]:-0}
    if ((va > vb)); then return 0; fi
    if ((va < vb)); then return 1; fi
  done
  return 1
}

if [ "$installed_version" = "$available_version" ]; then
  status="up-to-date"
  message="Claude Code $installed_version is the latest version available via $install_method. If you see an 'Update available' banner it is a false positive caused by the npm registry being ahead of your package manager."
elif version_gt "$available_version" "$installed_version"; then
  status="update-available"
  message="A real update is available via $install_method: $installed_version -> $available_version."
else
  status="up-to-date"
  message="Claude Code $installed_version is up to date (${install_method} latest: $available_version)."
fi

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Update check ($install_method): $message"
  }
}
EOF

exit 0