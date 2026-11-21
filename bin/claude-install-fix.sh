#!/usr/bin/env bash
set -euo pipefail

# This script demonstrates the fix for issue #83484:
# The `claude install` command was creating a broken symlink with literal %h
# instead of expanding the home directory path.
#
# Root Cause:
# The install subcommand was using a placeholder %h without expanding it to
# the actual home directory path, resulting in symlink targets like:
#   %h/.local/share/claude/versions/2.1.220 (broken)
# Instead of:
#   /home/user/.local/share/claude/versions/2.1.220 (correct)

INSTALL_ROOT="${HOME}/.local/share/claude/versions"
BIN_DIR="${HOME}/.local/bin"
LINK_PATH="${BIN_DIR}/claude"

info() {
  printf '[info] %s\n' "$1"
}

fail() {
  printf '[fail] %s\n' "$1" >&2
  exit 1
}

# Ensure install root exists
[ -d "$INSTALL_ROOT" ] || fail "Install root not found: $INSTALL_ROOT"

# Create bin directory if it doesn't exist
mkdir -p "$BIN_DIR"

# Find the latest installed version
LATEST_VERSION="$(
  {
    find "$INSTALL_ROOT" -mindepth 1 -maxdepth 1 \( -type d -o -type f -o -type l \) -printf '%f\n' 2>/dev/null || true
  } | sort -V | tail -n 1
)"

[ -n "$LATEST_VERSION" ] || fail "No installed Claude versions found in: $INSTALL_ROOT"

# Build the target path - CRITICAL: use $INSTALL_ROOT (expanded) not placeholder
TARGET_PATH="${INSTALL_ROOT}/${LATEST_VERSION}"

# Verify target exists (it's a valid directory or symlink)
[ -e "$TARGET_PATH" ] || [ -L "$TARGET_PATH" ] || fail "Target does not exist: $TARGET_PATH"

# Remove old symlink if it exists
rm -f "$LINK_PATH"

# Create NEW symlink with EXPANDED home path (FIX FOR #83484)
ln -s "$TARGET_PATH" "$LINK_PATH"

info "Created symlink: $LINK_PATH → $TARGET_PATH"
info "Symlink target correctly expanded (not literal %h)"
