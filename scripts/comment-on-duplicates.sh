#!/usr/bin/env bash
#
# Comments on a GitHub issue with a list of potential duplicates.
# Usage: ./comment-on-duplicates.sh --potential-duplicates 456 789 101
#
# The base issue number is read from the workflow event payload.
#

set -euo pipefail

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY not set}"
if ! [[ "$REPO" =~ ^[^/]+/[^/]+$ ]]; then
  echo "Error: GITHUB_REPOSITORY must use owner/repo format" >&2
  exit 1
fi

# Read from event payload so the issue number is bound to the triggering event.
# Falls back to workflow_dispatch inputs for manual runs.
BASE_ISSUE=$(jq -r '.issue.number // .inputs.issue_number // empty' "${GITHUB_EVENT_PATH:?GITHUB_EVENT_PATH not set}")
if ! [[ "$BASE_ISSUE" =~ ^[0-9]+$ ]]; then
  echo "Error: no issue number in event payload" >&2
  exit 1
fi

DUPLICATES=()

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --potential-duplicates)
      shift
      while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
        DUPLICATES+=("$1")
        shift
      done
      ;;
    *)
      echo "Error: unknown argument (only --potential-duplicates is accepted)" >&2
      exit 1
      ;;
  esac
done

# Validate duplicates
if [[ ${#DUPLICATES[@]} -eq 0 ]]; then
  echo "Error: --potential-duplicates requires at least one issue number" >&2
  exit 1
fi

if [[ ${#DUPLICATES[@]} -gt 3 ]]; then
  echo "Error: --potential-duplicates accepts at most 3 issues" >&2
  exit 1
fi

canonical_issue_number() {
  local number="$1"
  while [[ ${#number} -gt 1 && "${number:0:1}" == "0" ]]; do
    number="${number:1}"
  done
  printf '%s\n' "$number"
}

BASE_ISSUE_CANONICAL=$(canonical_issue_number "$BASE_ISSUE")
VALIDATED_DUPLICATES=()
for dup in "${DUPLICATES[@]}"; do
  if ! [[ "$dup" =~ ^[0-9]+$ ]]; then
    echo "Error: duplicate issue must be a number, got: $dup" >&2
    exit 1
  fi
  canonical_dup=$(canonical_issue_number "$dup")
  if [[ "$canonical_dup" == "$BASE_ISSUE_CANONICAL" ]]; then
    echo "Error: duplicate issue #$dup cannot reference the base issue itself" >&2
    exit 1
  fi
  if [[ ${#VALIDATED_DUPLICATES[@]} -gt 0 ]]; then
    for existing in "${VALIDATED_DUPLICATES[@]}"; do
      if [[ "$canonical_dup" == "$existing" ]]; then
        echo "Error: duplicate issue number was repeated: $dup" >&2
        exit 1
      fi
    done
  fi
  VALIDATED_DUPLICATES+=("$canonical_dup")
done
DUPLICATES=("${VALIDATED_DUPLICATES[@]}")

# Validate that base issue exists
if ! gh issue view "$BASE_ISSUE" --repo "$REPO" &>/dev/null; then
  echo "Error: issue #$BASE_ISSUE does not exist in $REPO" >&2
  exit 1
fi

# Workflow dispatch is at-least-once. A stable marker keeps retries from
# posting duplicate reports after a successful earlier run. Only this
# workflow's bot is trusted; an issue author can reproduce the hidden marker.
DEDUPE_BOT_LOGIN="${DEDUPE_BOT_LOGIN:-github-actions[bot]}"
EXISTING_REPORT=$(gh api --paginate --slurp \
  "repos/$REPO/issues/$BASE_ISSUE/comments?per_page=100" \
  | jq -r --arg bot "$DEDUPE_BOT_LOGIN" \
    'flatten[] | select(.user.type == "Bot" and .user.login == $bot and (.body | contains("<!-- claude-dedupe-report -->"))) | .id')
if [[ -n "$EXISTING_REPORT" ]]; then
  echo "Duplicate report already exists on issue #$BASE_ISSUE, skipping"
  exit 0
fi

# Validate that all duplicate issues exist
for dup in "${DUPLICATES[@]}"; do
  if ! gh issue view "$dup" --repo "$REPO" &>/dev/null; then
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
BODY+="<!-- claude-dedupe-report -->"$'\n'
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
