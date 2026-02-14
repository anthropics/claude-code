#!/bin/bash
# branch-create.sh — Create a Neon database branch
#
# Usage:
#   ./branch-create.sh <branch-name> [parent-branch-name]
#
# Environment:
#   NEON_API_KEY      — Required. Neon API key.
#   NEON_PROJECT_ID   — Required. Neon project ID.
#
# Outputs:
#   Branch ID, connection URI (pooled), and direct connection URI.

set -euo pipefail

BRANCH_NAME="${1:?Usage: $0 <branch-name> [parent-branch-name]}"
PARENT_NAME="${2:-}"

API_BASE="https://console.neon.tech/api/v2"

if [[ -z "${NEON_API_KEY:-}" ]]; then
  echo "Error: NEON_API_KEY is not set" >&2
  exit 1
fi

if [[ -z "${NEON_PROJECT_ID:-}" ]]; then
  echo "Error: NEON_PROJECT_ID is not set" >&2
  exit 1
fi

# Resolve parent branch ID if name provided
PARENT_ID=""
if [[ -n "$PARENT_NAME" ]]; then
  PARENT_ID=$(curl -s \
    -H "Authorization: Bearer $NEON_API_KEY" \
    "$API_BASE/projects/$NEON_PROJECT_ID/branches" \
    | jq -r ".branches[] | select(.name == \"$PARENT_NAME\") | .id")

  if [[ -z "$PARENT_ID" ]]; then
    echo "Error: Parent branch '$PARENT_NAME' not found" >&2
    exit 1
  fi
fi

# Build request body
BODY=$(jq -n \
  --arg name "$BRANCH_NAME" \
  --arg parent "$PARENT_ID" \
  '{
    branch: { name: $name } + (if $parent != "" then { parent_id: $parent } else {} end),
    endpoints: [{ type: "read_write" }]
  }')

echo "Creating branch: $BRANCH_NAME"
RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "$API_BASE/projects/$NEON_PROJECT_ID/branches")

BRANCH_ID=$(echo "$RESPONSE" | jq -r '.branch.id')
echo "Branch ID: $BRANCH_ID"

# Get connection URI
CONNECTION=$(curl -s \
  -H "Authorization: Bearer $NEON_API_KEY" \
  "$API_BASE/projects/$NEON_PROJECT_ID/connection_uri?branch_id=$BRANCH_ID&pooled=true&role_name=neondb_owner&database_name=neondb")

POOLED_URI=$(echo "$CONNECTION" | jq -r '.uri')
echo "Pooled URI: $POOLED_URI"

# Output for CI consumption
echo "branch_id=$BRANCH_ID"
echo "connection_uri=$POOLED_URI"
