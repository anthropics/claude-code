#!/usr/bin/env bash
set -euo pipefail

# Generate a compact textual prompt of a repository.
# Prefers gitingest if available; otherwise, falls back to a simple tree+concatenate strategy.

if [ $# -ne 1 ]; then
  echo "Usage: $0 /absolute/path/to/repo" >&2
  exit 2
fi

REPO_DIR="$1"
if [ ! -d "$REPO_DIR" ]; then
  echo "Not a directory: $REPO_DIR" >&2
  exit 2
fi

cd "$REPO_DIR"

# If repo has a remote on GitHub, try gitingest (HTTP); else fallback to local prompt.
REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"

if [[ "$REMOTE_URL" =~ github.com[:/][^/]+/[^/]+(.git)?$ ]]; then
  # Normalize to https URL
  if [[ "$REMOTE_URL" =~ ^git@github.com:(.*) ]]; then
    GH_PATH="${BASH_REMATCH[1]}"
  else
    GH_PATH="${REMOTE_URL#*github.com/}"
  fi
  GH_PATH="${GH_PATH%.git}"
  URL="https://gitingest.com/repo/${GH_PATH}"
  # Attempt network fetch; if it fails, fallback
  if command -v curl >/dev/null 2>&1; then
    if curl -fsSL "$URL"; then
      exit 0
    fi
  fi
fi

# Fallback: simple, readable prompt from local files
echo "# Repository prompt"
echo "Root: $(pwd)"
echo
echo "## File list"
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git ls-files | sed 's/^/- /'
else
  find . -type f -not -path '*/\.git/*' -maxdepth 6 | sed 's/^/- /'
fi

echo
echo "## Files"

LIST_CMD="git ls-files" \
  && if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then LIST_CMD="find . -type f -not -path '*/.git/*' -maxdepth 6 | sed 's|^\./||'"; fi

eval "$LIST_CMD" | while read -r f; do
  case "$f" in
    *.png|*.jpg|*.jpeg|*.gif|*.zip|*.tar|*.gz|*.svg|*.pdf)
      continue;;
  esac
  echo
  echo "--- FILE: $f ---"
  # Cap large files
  if [ -f "$f" ]; then
    head -c 200000 "$f"
  fi
done


