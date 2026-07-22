#!/usr/bin/env bash
# twilight focus-stack CLI: the single mutation path for
# agents/state/<clone-id>/focus.md. Used by the hooks, the /focus commands,
# and the implement skill. Read subcommands degrade to no-ops outside a
# twilight project; push creates the structure (first write wins).
#
# Usage: twilight-focus.sh <clone-id|show|push|pop|reset|lock> [args]

set -u

# Project root: nearest ancestor with agents/, else git toplevel, else cwd.
find_root() {
  local d="$PWD"
  while [ "$d" != "/" ]; do
    if [ -d "$d/agents" ]; then printf '%s' "$d"; return; fi
    d=$(dirname "$d")
  done
  git rev-parse --show-toplevel 2>/dev/null || printf '%s' "$PWD"
}

ROOT=$(find_root)
CLONE_ID="$(hostname)-$(printf '%s' "$ROOT" | sed 's|^/||; s|/|-|g')"
STATE_DIR="$ROOT/agents/state/$CLONE_ID"
STACK="$STATE_DIR/focus.md"
ARCHIVE="$STATE_DIR/focus-archive.md"
LOCK="$STATE_DIR/focus.lock"

cmd="${1:-}"
shift || true

case "$cmd" in
  clone-id)
    printf '%s\n' "$CLONE_ID"
    ;;

  show)
    if [ -s "$STACK" ]; then cat "$STACK"; else echo "empty"; fi
    ;;

  push)
    entry="${1:-}"
    [ -n "$entry" ] || { echo "push: entry required" >&2; exit 1; }
    # Valid forms: "[explore: ...]", "<plan>:<outline-id>", or "<plan>" alone.
    if [[ "$entry" =~ ^\[explore:\ .+\]$ ]]; then
      :
    elif [[ "$entry" =~ ^([A-Za-z0-9_-]+):([0-9.]+)$ ]]; then
      plan="${BASH_REMATCH[1]}"; id="${BASH_REMATCH[2]}"
      planfile="$ROOT/agents/$plan-plan.md"
      grep -q "^- $id \[" "$planfile" 2>/dev/null \
        || { echo "push: $id not found in $planfile" >&2; exit 1; }
    elif [[ "$entry" =~ ^[A-Za-z0-9_-]+$ ]] && [ -f "$ROOT/agents/$entry-plan.md" ]; then
      :
    else
      echo "push: invalid entry '$entry' (want <plan>:<id>, <plan>, or [explore: ...])" >&2
      exit 1
    fi
    mkdir -p "$STATE_DIR"
    tmp=$(mktemp) || exit 1
    printf '%s  %s\n' "$entry" "$(date +%F)" > "$tmp"
    [ -f "$STACK" ] && cat "$STACK" >> "$tmp"
    mv "$tmp" "$STACK"
    ;;

  pop)
    [ -s "$STACK" ] || exit 0
    head -1 "$STACK" | sed 's/  [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}$//'
    tmp=$(mktemp) || exit 1
    tail -n +2 "$STACK" > "$tmp"
    mv "$tmp" "$STACK"
    ;;

  reset)
    [ -s "$STACK" ] || exit 0
    {
      printf '## reset %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
      cat "$STACK"
      printf '\n'
    } >> "$ARCHIVE"
    : > "$STACK"
    ;;

  gate)
    # Pop gate (spec 3.1.5): evidence in the plan, not model claims.
    # Exit 0 = pop allowed; exit 1 = unmet criteria printed.
    if [ "${1:-}" = "--force" ]; then exit 0; fi
    entry="${1:-}"
    [ -n "$entry" ] || { echo "gate: entry required" >&2; exit 1; }
    if [[ "$entry" =~ ^\[explore:\ .+\]$ ]]; then
      exit 0
    elif [[ "$entry" =~ ^([A-Za-z0-9_-]+):([0-9.]+)$ ]]; then
      plan="${BASH_REMATCH[1]}"; id="${BASH_REMATCH[2]}"
      planfile="$ROOT/agents/$plan-plan.md"
      line=$(grep -m1 "^- $id \[" "$planfile" 2>/dev/null)
      [ -n "$line" ] || { echo "gate: $id not found in $planfile"; exit 1; }
      case "$line" in
        "- $id [x]"*) exit 0 ;;
        *) echo "$line"; exit 1 ;;
      esac
    elif [ -f "$ROOT/agents/$entry-plan.md" ]; then
      unmet=$(grep -E '^- [0-9.]+ \[[ ~]\]' "$ROOT/agents/$entry-plan.md")
      [ -z "$unmet" ] && exit 0
      echo "$unmet"; exit 1
    else
      echo "gate: unknown entry '$entry'"; exit 1
    fi
    ;;

  lock)
    sub="${1:-check}"; sid="${2:-}"
    case "$sub" in
      acquire)
        [ -n "$sid" ] || { echo "lock acquire: session id required" >&2; exit 1; }
        mkdir -p "$STATE_DIR"
        printf '%s\n' "$sid" > "$LOCK"
        ;;
      check)
        if [ -f "$LOCK" ]; then
          owner=$(cat "$LOCK")
          if [ -z "$sid" ] || [ "$owner" = "$sid" ]; then echo "ok"; else echo "locked by $owner"; fi
        else
          echo "ok"
        fi
        ;;
      release)
        if [ -f "$LOCK" ] && [ "$(cat "$LOCK")" = "${sid:-}" ]; then rm -f "$LOCK"; fi
        ;;
      *) echo "lock: unknown subcommand '$sub'" >&2; exit 1 ;;
    esac
    ;;

  *)
    # Unknown/absent subcommand (including stdin-fed hook misuse): stay harmless.
    cat > /dev/null 2>&1 || true
    exit 0
    ;;
esac
