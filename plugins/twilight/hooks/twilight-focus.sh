#!/usr/bin/env bash
# twilight focus-stack CLI: the single mutation path for the focus stack, and
# the shared parser for plans and the INDEX. Used by the hooks, the /focus
# commands, and the implement skill.
#
# Layout defaults (overridable via a .twilight file at the project root with
# KEY=VALUE lines): SPECS_DIR=specs  PLANS_DIR=agents  STATE_DIR=<plans>/state
# MULTI_CLONE=0. With MULTI_CLONE=1 the stack is keyed per working copy
# (<STATE_DIR>/<clone-id>/focus.md) for worktree/multi-clone setups; the
# default is one stack per project (<STATE_DIR>/focus.md).
#
# Usage: twilight-focus.sh <clone-id|root|show|push|pop|gate|reset|lock|plans|next> [args]

set -u

find_root() {
  local d="$PWD"
  while [ "$d" != "/" ]; do
    if [ -f "$d/.twilight" ] || [ -d "$d/agents" ]; then printf '%s' "$d"; return; fi
    d=$(dirname "$d")
  done
  git rev-parse --show-toplevel 2>/dev/null || printf '%s' "$PWD"
}

ROOT=$(find_root)

SPECS_DIR="specs"; PLANS_DIR="agents"; STATE_DIR=""; MULTI_CLONE="0"
if [ -f "$ROOT/.twilight" ]; then
  while IFS='=' read -r k v; do
    case "$k" in
      SPECS_DIR) SPECS_DIR="$v" ;;
      PLANS_DIR) PLANS_DIR="$v" ;;
      STATE_DIR) STATE_DIR="$v" ;;
      MULTI_CLONE) MULTI_CLONE="$v" ;;
    esac
  done < "$ROOT/.twilight"
fi
[ -n "$STATE_DIR" ] || STATE_DIR="$PLANS_DIR/state"

CLONE_ID="$(hostname)-$(printf '%s' "$ROOT" | sed 's|^/||; s|/|-|g')"
if [ "$MULTI_CLONE" = "1" ]; then
  STATE_PATH="$ROOT/$STATE_DIR/$CLONE_ID"
else
  STATE_PATH="$ROOT/$STATE_DIR"
fi
STACK="$STATE_PATH/focus.md"
ARCHIVE="$STATE_PATH/focus-archive.md"
LOCK="$STATE_PATH/focus.lock"

# First line of the plan carrying <id>'s checkbox, either form:
#   "- <id> [x] ..."  or  "- [x] <id> ..."
plan_line() { # $1=planfile $2=id
  grep -m1 -E "^- $2 \[.\]|^- \[.\] $2( |$)" "$1" 2>/dev/null
}
# All unchecked/blocked checkbox lines of a plan, either form.
unmet_lines() { # $1=planfile
  grep -E '^- [0-9.]+ \[[ ~]\]|^- \[[ ~]\] [0-9.]+' "$1" 2>/dev/null
}

cmd="${1:-}"
shift || true

case "$cmd" in
  clone-id)
    printf '%s\n' "$CLONE_ID"
    ;;

  root)
    # Prints the project root only when it is a twilight project.
    if [ -f "$ROOT/.twilight" ] || [ -d "$ROOT/$PLANS_DIR" ]; then printf '%s\n' "$ROOT"; fi
    ;;

  plans)
    # Active plan names from the INDEX: any line naming <name>-plan with "active".
    f="$ROOT/$SPECS_DIR/INDEX.md"
    [ -f "$f" ] || exit 0
    grep 'active' "$f" 2>/dev/null | grep -oE '[A-Za-z0-9_-]+-plan' | sed 's/-plan$//' | sort -u
    ;;

  next)
    # First unchecked/blocked line of a plan.
    plan="${1:-}"
    [ -n "$plan" ] || exit 0
    unmet_lines "$ROOT/$PLANS_DIR/$plan-plan.md" | head -1
    ;;

  show)
    if [ -s "$STACK" ]; then cat "$STACK"; else echo "empty"; fi
    ;;

  push)
    entry="${1:-}"
    [ -n "$entry" ] || { echo "push: entry required" >&2; exit 1; }
    if [[ "$entry" =~ ^\[explore:\ .+\]$ ]]; then
      :
    elif [[ "$entry" =~ ^([A-Za-z0-9_-]+):([0-9.]+)$ ]]; then
      plan="${BASH_REMATCH[1]}"; id="${BASH_REMATCH[2]}"
      planfile="$ROOT/$PLANS_DIR/$plan-plan.md"
      [ -n "$(plan_line "$planfile" "$id")" ] \
        || { echo "push: $id not found in $planfile" >&2; exit 1; }
    elif [[ "$entry" =~ ^[A-Za-z0-9_-]+$ ]] && [ -f "$ROOT/$PLANS_DIR/$entry-plan.md" ]; then
      :
    else
      echo "push: invalid entry '$entry' (want <plan>:<id>, <plan>, or [explore: ...])" >&2
      exit 1
    fi
    mkdir -p "$STATE_PATH"
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

  gate)
    # Pop gate: evidence in the plan, not model claims.
    # Exit 0 = pop allowed; exit 1 = unmet criteria printed.
    if [ "${1:-}" = "--force" ]; then exit 0; fi
    entry="${1:-}"
    [ -n "$entry" ] || { echo "gate: entry required" >&2; exit 1; }
    if [[ "$entry" =~ ^\[explore:\ .+\]$ ]]; then
      exit 0
    elif [[ "$entry" =~ ^([A-Za-z0-9_-]+):([0-9.]+)$ ]]; then
      plan="${BASH_REMATCH[1]}"; id="${BASH_REMATCH[2]}"
      line=$(plan_line "$ROOT/$PLANS_DIR/$plan-plan.md" "$id")
      [ -n "$line" ] || { echo "gate: $id not found in $plan-plan.md"; exit 1; }
      case "$line" in
        "- $id [x]"*|"- [x] $id"*) exit 0 ;;
        *) echo "$line"; exit 1 ;;
      esac
    elif [ -f "$ROOT/$PLANS_DIR/$entry-plan.md" ]; then
      unmet=$(unmet_lines "$ROOT/$PLANS_DIR/$entry-plan.md")
      [ -z "$unmet" ] && exit 0
      echo "$unmet"; exit 1
    else
      echo "gate: unknown entry '$entry'"; exit 1
    fi
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

  lock)
    sub="${1:-check}"; sid="${2:-}"
    case "$sub" in
      acquire)
        [ -n "$sid" ] || { echo "lock acquire: session id required" >&2; exit 1; }
        mkdir -p "$STATE_PATH"
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
