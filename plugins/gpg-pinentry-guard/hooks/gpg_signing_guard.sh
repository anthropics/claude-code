#!/usr/bin/env bash
# gpg_signing_guard.sh — PreToolUse hook for Claude Code
#
# Detects git commands that would trigger GPG signing with a terminal-based
# pinentry program. Since Claude Code's Ink renderer holds exclusive control
# of the terminal, pinentry-curses/pinentry-tty cannot read user input,
# causing "No passphrase given" failures.
#
# This hook blocks such commands early and provides actionable guidance.
#
# Exit codes:
#   0 — Allow the command (not a signing command, passphrase cached, GUI pinentry, etc.)
#   2 — Block the command (terminal pinentry would fail)
#
# Known limitations:
#   - Git aliases (e.g., `git ci` -> `commit --no-gpg-sign`) are not resolved
#   - Inline config (`git -c commit.gpgsign=true commit`) bypasses config check

set -euo pipefail

# Read PreToolUse JSON from stdin
input=$(cat)

# Only process Bash tool calls
tool_name=$(printf '%s' "$input" | jq -r '.tool_name // empty')
if [[ "$tool_name" != "Bash" ]]; then
  exit 0
fi

# Extract the command
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
if [[ -z "$command" ]]; then
  exit 0
fi

# Step 1: Is this a git command that triggers signing?
# Uses \b word boundaries and .* to handle compound commands (&&, ||, ;),
# env prefixes, git flags (--no-pager, -C, -c), full paths (/usr/bin/git), etc.
signing_type=""
if printf '%s\n' "$command" | grep -qE '\bgit\b.*\bcommit\b'; then
  signing_type="commit"
elif printf '%s\n' "$command" | grep -qE '\bgit\b.*\btag\b'; then
  signing_type="tag"
elif printf '%s\n' "$command" | grep -qE '\bgit\b.*\bmerge\b'; then
  signing_type="merge"
fi

if [[ -z "$signing_type" ]]; then
  exit 0
fi

# Step 2: Does the command already have --no-gpg-sign?
if printf '%s\n' "$command" | grep -qE -- '--no-gpg-sign'; then
  exit 0
fi

# Step 3: Is GPG signing enabled for this command type?
cwd=$(printf '%s' "$input" | jq -r '.cwd // "."')

# Check for explicit signing flags in the command
has_explicit_sign=false
if printf '%s\n' "$command" | grep -qE -- '(\s|^)(-S|--gpg-sign)\b'; then
  has_explicit_sign=true
fi

# Check the relevant git config for the signing type
gpgsign_config="false"
case "$signing_type" in
  commit)
    gpgsign_config=$(git -C "$cwd" config --get commit.gpgsign 2>/dev/null || echo "false")
    ;;
  tag)
    # git tag signs with -s/--sign explicitly, or tag.gpgsign for annotated tags
    if printf '%s\n' "$command" | grep -qE -- '(\s|^)(-s|--sign)\b'; then
      has_explicit_sign=true
    else
      gpgsign_config=$(git -C "$cwd" config --get tag.gpgsign 2>/dev/null || echo "false")
    fi
    ;;
  merge)
    gpgsign_config=$(git -C "$cwd" config --get merge.gpgsign 2>/dev/null || echo "false")
    ;;
esac

if [[ "$gpgsign_config" != "true" && "$has_explicit_sign" != "true" ]]; then
  exit 0
fi

# Step 4: Determine the pinentry program
pinentry_program=""

# Try gpg-agent.conf first (last matching line wins, matching GnuPG behavior)
gpg_agent_conf="${GNUPGHOME:-$HOME/.gnupg}/gpg-agent.conf"
if [[ -f "$gpg_agent_conf" ]]; then
  pinentry_program=$(grep -E '^\s*pinentry-program\s+' "$gpg_agent_conf" 2>/dev/null \
    | tail -1 | awk '{print $2}' || true)
fi

# Fall back to system default
if [[ -z "$pinentry_program" ]]; then
  pinentry_program=$(command -v pinentry 2>/dev/null || echo "pinentry")
  # Resolve symlinks to find the actual binary
  if [[ -L "$pinentry_program" ]]; then
    pinentry_program=$(readlink -f "$pinentry_program" 2>/dev/null || echo "$pinentry_program")
  fi
fi

# Step 5: Is it a GUI pinentry? (GUI pinentry opens its own window — no conflict)
pinentry_basename=$(basename "$pinentry_program" 2>/dev/null || echo "")
case "$pinentry_basename" in
  pinentry-gnome3|pinentry-gtk*|pinentry-qt*|pinentry-mac|pinentry-wsl|pinentry-x11)
    exit 0
    ;;
esac

# Step 6: Is the passphrase already cached in gpg-agent?
# gpg-connect-agent KEYINFO requires a keygrip (40-hex-char), not a key ID.
signing_key=$(git -C "$cwd" config --get user.signingkey 2>/dev/null || echo "")
if [[ -n "$signing_key" ]]; then
  # Prefer signing subkey keygrip ([S] capability), fall back to primary key
  keygrip=$(gpg --with-keygrip --list-secret-keys "$signing_key" 2>/dev/null \
    | grep -B1 'Keygrip' | grep -A1 '\[S\]' | grep 'Keygrip' | head -1 \
    | awk -F= '{print $2}' | tr -d ' ' || true)

  if [[ -z "$keygrip" ]]; then
    keygrip=$(gpg --with-keygrip --list-secret-keys "$signing_key" 2>/dev/null \
      | grep -A2 '^\s*sec' | grep 'Keygrip' | head -1 \
      | awk -F= '{print $2}' | tr -d ' ' || true)
  fi

  if [[ -n "$keygrip" ]]; then
    cache_status=$(gpg-connect-agent "KEYINFO --no-ask $keygrip ERR" /bye 2>/dev/null || echo "")
    if printf '%s\n' "$cache_status" | grep -qE '^S KEYINFO\s+\S+\s+\S+\s+1'; then
      exit 0
    fi
  fi
fi

# All checks failed — this command will trigger a broken terminal pinentry.
# Block with exit 2 and provide guidance.

cat >&2 <<'BLOCK_MESSAGE'
GPG signing blocked: terminal pinentry conflict detected.

Claude Code's terminal renderer holds exclusive control of keyboard input.
When git triggers GPG signing, pinentry-curses/pinentry-tty cannot read
your passphrase, causing a "No passphrase given" failure.

To fix this, do ONE of the following:

  1. Cache your passphrase first (run in a separate terminal):
       echo "test" | gpg --clearsign > /dev/null
     Then retry the commit in Claude Code.

  2. Use --no-gpg-sign to skip signing for this commit:
       git commit --no-gpg-sign -m "your message"

  3. Switch to a GUI pinentry (permanent fix):
       echo "pinentry-program /usr/bin/pinentry-gnome3" >> ~/.gnupg/gpg-agent.conf
       gpgconf --reload gpg-agent

  4. Increase gpg-agent cache timeout in ~/.gnupg/gpg-agent.conf:
       default-cache-ttl 86400
       max-cache-ttl 86400
BLOCK_MESSAGE

exit 2
