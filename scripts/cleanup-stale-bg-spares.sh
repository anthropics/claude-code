#!/usr/bin/env bash
# Clean up stale cc-daemon bg-spare processes whose cwd has been deleted.
# Also removes orphan session directories under ~/.claude/projects/.
# Usage: ./cleanup-stale-bg-spares.sh [--dry-run]

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

echo "=== Scanning for stale bg-spare processes ==="

# Find all cc-daemon spare processes
STALE_PIDS=()
while IFS= read -r pid; do
  cwd=$(lsof -p "$pid" -Fn 2>/dev/null | grep '^fcwd' | head -1 | cut -c2- || true)
  if [[ -z "$cwd" ]]; then
    continue
  fi
  if [[ ! -d "$cwd" ]]; then
    echo "STALE: pid=$pid cwd=$cwd (deleted)"
    STALE_PIDS+=("$pid")
  fi
done < <(pgrep -f -- "--bg-spare" 2>/dev/null || true)

if [[ ${#STALE_PIDS[@]} -eq 0 ]]; then
  echo "No stale spares found."
else
  echo "Found ${#STALE_PIDS[@]} stale spare(s)."
  if [[ "$DRY_RUN" == false ]]; then
    kill -TERM "${STALE_PIDS[@]}" 2>/dev/null || true
    echo "Killed stale spares."
  else
    echo "Dry-run: would kill pids ${STALE_PIDS[*]}"
  fi
fi

echo ""
echo "=== Scanning for orphan session dirs under ~/.claude/projects/ ==="

ORPHAN_DIRS=()
for dir in ~/.claude/projects/*/; do
  if [[ ! -d "$dir" ]]; then
    continue
  fi
  # Decode the slug: path is encoded as -Users-lyc-Projects-...
  # We check if the real path exists
  slug=$(basename "$dir")
  # Simple heuristic: if it contains "--claude-worktrees" it's from a worktree
  if [[ "$slug" == *"--claude-worktrees"* ]]; then
    ORPHAN_DIRS+=("$dir")
    echo "ORPHAN: $dir (worktree-derived slug)"
  fi
done

if [[ ${#ORPHAN_DIRS[@]} -eq 0 ]]; then
  echo "No orphan worktree-derived session dirs found."
else
  echo "Found ${#ORPHAN_DIRS[@]} orphan dir(s)."
  if [[ "$DRY_RUN" == false ]]; then
    rm -rf "${ORPHAN_DIRS[@]}"
    echo "Removed orphan dirs."
  else
    echo "Dry-run: would remove:"
    for d in "${ORPHAN_DIRS[@]}"; do echo "  $d"; done
  fi
fi