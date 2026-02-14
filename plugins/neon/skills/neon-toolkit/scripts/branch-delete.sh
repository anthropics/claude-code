#!/bin/bash
# branch-delete.sh — Delete a Neon database branch
#
# Usage:
#   ./branch-delete.sh <branch-name-or-id>
#
# Environment:
#   NEON_API_KEY      — Required. Neon API key.
#   NEON_PROJECT_ID   — Required. Neon project ID.

set -euo pipefail

BRANCH="${1:?Usage: $0 <branch-name-or-id>}"

API_BASE="https://console.neon.tech/api/v2"

if [[ -z "${NEON_API_KEY:-}" ]]; then
  echo "Error: NEON_API_KEY is not set" >&2
  exit 1
fi

if [[ -z "${NEON_PROJECT_ID:-}" ]]; then
  echo "Error: NEON_PROJECT_ID is not set" >&2
  exit 1
fi

# If input looks like a name (not br-xxx), resolve to ID
BRANCH_ID="$BRANCH"
if [[ ! "$BRANCH" =~ ^br- ]]; then
  BRANCH_ID=$(curl -s \
    -H "Authorization: Bearer $NEON_API_KEY" \
    "$API_BASE/projects/$NEON_PROJECT_ID/branches" \
    | jq -r ".branches[] | select(.name == \"$BRANCH\") | .id")

  if [[ -z "$BRANCH_ID" ]]; then
    echo "Error: Branch '$BRANCH' not found" >&2
    exit 1
  fi
fi

echo "Deleting branch: $BRANCH (ID: $BRANCH_ID)"
curl -s -X DELETE \
  -H "Authorization: Bearer $NEON_API_KEY" \
  "$API_BASE/projects/$NEON_PROJECT_ID/branches/$BRANCH_ID"

echo "Branch deleted."
