#!/usr/bin/env bash
#
# Comments on a GitHub issue with a list of potential duplicates.
# Usage: ./comment-on-duplicates.sh --base-issue 123 --potential-duplicates 456 789 101
#

set -euo pipefail

REPO="${GH_REPO:-${GITHUB_REPOSITORY:-}}"
if [[ -z "$REPO" || ! "$REPO" =~ ^[^/]+/[^/]+$ ]]; then
  echo "Error: GH_REPO or GITHUB_REPOSITORY must be set to owner/repo format (e.g., GITHUB_REPOSITORY=anthropics/claude-code)" >&2
  exit 1
fi
BASE_ISSUE=""
DUPLICATES=()
SEEN_DUPLICATES=()

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --base-issue)
      if [[ $# -lt 2 || "$2" =~ ^-- ]]; then
        echo "Error: --base-issue requires an issue number" >&2
        exit 1
      fi
      BASE_ISSUE="$2"
      shift 2
      ;;
    --potential-duplicates)
      shift
      if [[ $# -eq 0 || "$1" =~ ^-- ]]; then
        echo "Error: --potential-duplicates requires at least one issue number" >&2
        exit 1
      fi
      while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
        DUPLICATES+=("$1")
        shift
      done
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Validate base issue
if [[ -z "$BASE_ISSUE" ]]; then
  echo "Error: --base-issue is required" >&2
  exit 1
fi

if ! [[ "$BASE_ISSUE" =~ ^[0-9]+$ ]]; then
  echo "Error: --base-issue must be a number, got: $BASE_ISSUE" >&2
  exit 1
fi

# Validate duplicates
if [[ ${#DUPLICATES[@]} -eq 0 ]]; then
  echo "Error: --potential-duplicates requires at least one issue number" >&2
  exit 1
fi

if [[ ${#DUPLICATES[@]} -gt 3 ]]; then
  echo "Error: --potential-duplicates accepts at most 3 issues" >&2
  exit 1
fi

for dup in "${DUPLICATES[@]}"; do
  if ! [[ "$dup" =~ ^[0-9]+$ ]]; then
    echo "Error: duplicate issue must be a number, got: $dup" >&2
    exit 1
  fi
  if [[ "$dup" == "$BASE_ISSUE" ]]; then
    echo "Error: duplicate issue list cannot include the base issue #$BASE_ISSUE" >&2
    exit 1
  fi
  for seen_dup in "${SEEN_DUPLICATES[@]:-}"; do
    if [[ "$dup" == "$seen_dup" ]]; then
      echo "Error: duplicate issue list cannot include issue #$dup more than once" >&2
      exit 1
    fi
  done
  SEEN_DUPLICATES+=("$dup")
done

# Validate that base issue exists
if ! "$(dirname "$0")/gh.sh" issue view "$BASE_ISSUE" &>/dev/null; then
  echo "Error: issue #$BASE_ISSUE does not exist in $REPO" >&2
  exit 1
fi

# Validate that all duplicate issues exist
for dup in "${DUPLICATES[@]}"; do
  if ! "$(dirname "$0")/gh.sh" issue view "$dup" &>/dev/null; then
    echo "Error: issue #$dup does not exist in $REPO" >&2
    exit 1
  fi
done

# Build comment body
COUNT=${#DUPLICATES[@]}
if [[ $COUNT -eq 1 ]]; then
  HEADER="Found 1 possible duplicate issue:"
else
  HEADER="Found $COUNT possible duplicate issues:"
fi

BODY="$HEADER"$'\n\n'
INDEX=1
for dup in "${DUPLICATES[@]}"; do
  BODY+="$INDEX. https://github.com/$REPO/issues/$dup"$'\n'
  ((INDEX++))
done

BODY+=$'\n'"This issue will be automatically closed as a duplicate in 3 days."$'\n\n'
BODY+="- If your issue is a duplicate, please close it and 👍 the existing issue instead"$'\n'
BODY+="- To prevent auto-closure, add a comment or 👎 this comment"$'\n\n'
BODY+="🤖 Generated with [Claude Code](https://claude.ai/code)"

# Post the comment
gh issue comment "$BASE_ISSUE" --repo "$REPO" --body "$BODY"

echo "Posted duplicate comment on issue #$BASE_ISSUE"
