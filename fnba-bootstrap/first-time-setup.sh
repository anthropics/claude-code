#!/usr/bin/env bash
# first-time-setup.sh — lay down a starter ~/.claude/ tree in homebase.
# Invoked automatically by scripts/wsl-up.sh when the sentinel is absent.
# Idempotent: every file write is guarded so re-running fills gaps without
# clobbering existing user content. Re-runnable manually by removing
# ~/.claude/.fnba-bootstrap-done.

set -euo pipefail

BOOTSTRAP_ROOT="/opt/fnba-bootstrap"
SENTINEL="$HOME/.claude/.fnba-bootstrap-done"
USE_PAT=0

for arg in "$@"; do
  case "$arg" in
    --use-pat) USE_PAT=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 64 ;;
  esac
done

# 0. Idempotency guard
if [[ -f "$SENTINEL" ]]; then
  echo "Bootstrap already completed ($(cat "$SENTINEL"))."
  echo "Remove $SENTINEL to re-run."
  exit 0
fi

cat <<EOF
============================================================
FNBA Claude Code — first-time homebase setup
============================================================

About to populate your homebase (= your WSL home directory)
with starter Claude Code config:

  ~/CLAUDE.md                                    (top-level project guide)
  ~/.claude/commands/pde.md                      (/pde slash command)
  ~/.claude/settings.json                        (with Atlassian MCP)
  ~/.claude/projects/-home-$USER/memory/MEMORY.md
  ~/.claude/.fnba-bootstrap-done                 (sentinel)

Each write is guarded — existing files will NOT be overwritten.
EOF

read -r -p "Proceed? [Y/n] " ans
case "${ans:-Y}" in
  [Yy]*) ;;
  *) echo "Aborted."; exit 1 ;;
esac

# 1. User identity
default_name="$(git config --global user.name 2>/dev/null || echo "$USER")"
default_email="$(git config --global user.email 2>/dev/null || echo "${USER}@fnba.com")"
read -r -p "Your name [${default_name}]: " USER_NAME
USER_NAME="${USER_NAME:-$default_name}"
read -r -p "Your email [${default_email}]: " USER_EMAIL
USER_EMAIL="${USER_EMAIL:-$default_email}"

# 2. Git / SSH
if [[ "$USE_PAT" -eq 1 ]]; then
  echo "PAT mode requested but not yet implemented — see README.fnba.md."
  echo "Continuing without auth setup."
elif compgen -G "$HOME/.ssh/id_*" > /dev/null; then
  echo ">> SSH key found in ~/.ssh — using SSH for git auth."
  mkdir -p "$HOME/.ssh"
  touch "$HOME/.ssh/known_hosts"
  if ! grep -q "^github.com " "$HOME/.ssh/known_hosts" 2>/dev/null; then
    ssh-keyscan -t rsa,ecdsa,ed25519 github.com 2>/dev/null >> "$HOME/.ssh/known_hosts" || true
  fi
  git config --global --get user.name  >/dev/null 2>&1 || git config --global user.name  "$USER_NAME"
  git config --global --get user.email >/dev/null 2>&1 || git config --global user.email "$USER_EMAIL"
else
  cat <<EOF
>> No SSH key found in ~/.ssh.
   Recommended: run \`ssh-keygen -t ed25519 -C "$USER_EMAIL"\` and add the
   public key to your GitHub account, then re-run this script.
   Fallback: \`first-time-setup.sh --use-pat\` (PAT mode — coming soon).
   Continuing without git auth setup.
EOF
fi

# 3. Lay down bundle (guarded copies)
write_if_absent() {
  local dest="$1" src="$2"
  if [[ -e "$dest" ]]; then
    echo "   skip (exists): $dest"
  else
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "   wrote: $dest"
  fi
}

interpolate_if_absent() {
  local dest="$1" src="$2"
  if [[ -e "$dest" ]]; then
    echo "   skip (exists): $dest"
  else
    mkdir -p "$(dirname "$dest")"
    sed -e "s|{{USER_NAME}}|$USER_NAME|g" \
        -e "s|{{USER_EMAIL}}|$USER_EMAIL|g" \
        -e "s|{{USER}}|$USER|g" \
        "$src" > "$dest"
    echo "   wrote: $dest"
  fi
}

echo ">> Writing files..."
interpolate_if_absent "$HOME/CLAUDE.md"                                       "$BOOTSTRAP_ROOT/CLAUDE.md.tpl"
write_if_absent      "$HOME/.claude/commands/pde.md"                          "$BOOTSTRAP_ROOT/claude/commands/pde.md"
interpolate_if_absent "$HOME/.claude/settings.json"                           "$BOOTSTRAP_ROOT/claude/settings.json.tpl"
write_if_absent      "$HOME/.claude/projects/-home-$USER/memory/MEMORY.md"    "$BOOTSTRAP_ROOT/claude/projects/-home-USER/memory/MEMORY.md"

# 4. Sentinel
mkdir -p "$HOME/.claude"
sha="$(cat "$BOOTSTRAP_ROOT/VERSION" 2>/dev/null || echo "unknown")"
printf 'bootstrap completed: %s | fork: %s\n' "$(date -Iseconds)" "$sha" > "$SENTINEL"

cat <<EOF

============================================================
Done. To re-run: rm $SENTINEL
Restart Claude Code to pick up the new commands and MCP servers.
============================================================
EOF
