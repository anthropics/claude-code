#!/usr/bin/env bash
set -euo pipefail

# Wrapper around gh CLI that only allows specific subcommands and flags.
# All commands are scoped to the current repository via GH_REPO or GITHUB_REPOSITORY.
#
# Usage:
#   ./scripts/gh.sh issue view 123
#   ./scripts/gh.sh issue view 123 --comments
#   ./scripts/gh.sh issue list --state open --limit 20
#   ./scripts/gh.sh search issues "search query" --limit 10
#   ./scripts/gh.sh label list --limit 100

ALLOWED_FLAGS=(--comments --state --limit --label)
FLAGS_WITH_VALUES=(--state --limit --label)

SUB1="${1:-}"
SUB2="${2:-}"
CMD="$SUB1 $SUB2"
case "$CMD" in
  "issue view"|"issue list"|"search issues"|"label list")
    ;;
  *)
    exit 1
    ;;
esac

shift 2

# Separate flags from positional arguments
POSITIONAL=()
FLAGS=()
skip_next=false
for arg in "$@"; do
  if [[ "$skip_next" == true ]]; then
    FLAGS+=("$arg")
    skip_next=false
  elif [[ "$arg" == -* ]]; then
    flag="${arg%%=*}"
    matched=false
    for allowed in "${ALLOWED_FLAGS[@]}"; do
      if [[ "$flag" == "$allowed" ]]; then
        matched=true
        break
      fi
    done
    if [[ "$matched" == false ]]; then
      exit 1
    fi
    FLAGS+=("$arg")
    # If flag expects a value and isn't using = syntax, skip next arg
    if [[ "$arg" != *=* ]]; then
      for vflag in "${FLAGS_WITH_VALUES[@]}"; do
        if [[ "$flag" == "$vflag" ]]; then
          skip_next=true
          break
        fi
      done
    fi
  else
    POSITIONAL+=("$arg")
  fi
done

REPO="${GH_REPO:-${GITHUB_REPOSITORY:-}}"

if [[ "$CMD" == "search issues" ]]; then
  if [[ -z "$REPO" ]]; then
    exit 1
  fi
  QUERY="${POSITIONAL[0]:-}"
  QUERY_LOWER=$(echo "$QUERY" | tr '[:upper:]' '[:lower:]')
  if [[ "$QUERY_LOWER" == *"repo:"* || "$QUERY_LOWER" == *"org:"* || "$QUERY_LOWER" == *"user:"* ]]; then
    exit 1
  fi
  gh "$SUB1" "$SUB2" "$QUERY" --repo "$REPO" "${FLAGS[@]}"
else
  # Reject URLs in positional args to prevent cross-repo access
  for pos in "${POSITIONAL[@]}"; do
    if [[ "$pos" == http://* || "$pos" == https://* ]]; then
      exit 1
    fi
  done
  gh "$SUB1" "$SUB2" "${POSITIONAL[@]}" "${FLAGS[@]}"
fi
