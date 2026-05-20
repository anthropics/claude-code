#!/usr/bin/env bash
# cleanup.sh <orch-dir>
# Remove orchestration temp directory.

ORCH_DIR="$1"
[ -z "$ORCH_DIR" ] && { echo "Usage: cleanup.sh <orch-dir>"; exit 1; }
[ -d "$ORCH_DIR" ] && rm -rf "$ORCH_DIR"
echo "Cleaned up $ORCH_DIR"
