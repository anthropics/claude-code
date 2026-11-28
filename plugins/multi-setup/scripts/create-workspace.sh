#!/bin/bash

# Multi Setup - Create a parallel development workspace
# Clones the current repo into a new folder and opens Claude Code in a new terminal window.

set -euo pipefail

# ── Argument parsing ────────────────────────────────────────────────────────

WORKSPACE_NAME=""
BRANCH=""
CONFIG_MODE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat <<'HELP'
multi-setup — Create a parallel development workspace

USAGE:
  /multi-setup [workspace-name] [--branch BRANCH] [--config copy|symlink]

ARGUMENTS:
  workspace-name        Name for the new workspace folder (default: workspace-N)

OPTIONS:
  --branch <branch>     Branch to check out after cloning (default: current branch)
  --config copy|symlink How to handle .claude/ config (prompted if omitted)
  -h, --help            Show this help

EXAMPLES:
  /multi-setup
  /multi-setup feature-auth --branch feature/auth
  /multi-setup hotfix --branch main --config copy
HELP
      exit 0
      ;;
    --branch)
      BRANCH="${2:-}"
      [[ -z "$BRANCH" ]] && { echo "❌ --branch requires a value" >&2; exit 1; }
      shift 2
      ;;
    --config)
      CONFIG_MODE="${2:-}"
      if [[ "$CONFIG_MODE" != "copy" && "$CONFIG_MODE" != "symlink" ]]; then
        echo "❌ --config must be 'copy' or 'symlink', got: $CONFIG_MODE" >&2
        exit 1
      fi
      shift 2
      ;;
    -*)
      echo "❌ Unknown option: $1" >&2
      exit 1
      ;;
    *)
      WORKSPACE_NAME="$1"
      shift
      ;;
  esac
done

# ── Validate git repo ────────────────────────────────────────────────────────

if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo "❌ Not inside a git repository." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
if [[ -z "$REMOTE_URL" ]]; then
  echo "❌ No 'origin' remote found. Cannot clone." >&2
  exit 1
fi

REPO_NAME="$(basename "$REPO_ROOT")"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
TARGET_BRANCH="${BRANCH:-$CURRENT_BRANCH}"

# ── Determine workspace path ─────────────────────────────────────────────────

BASE_DIR="$(dirname "$REPO_ROOT")/${REPO_NAME}-workspaces"
mkdir -p "$BASE_DIR"

# Auto-name if not provided
if [[ -z "$WORKSPACE_NAME" ]]; then
  N=1
  while [[ -e "$BASE_DIR/workspace-$N" ]]; do
    ((N++))
  done
  WORKSPACE_NAME="workspace-$N"
fi

WORKSPACE_PATH="$BASE_DIR/$WORKSPACE_NAME"

if [[ -e "$WORKSPACE_PATH" ]]; then
  echo "❌ Workspace already exists: $WORKSPACE_PATH" >&2
  exit 1
fi

# ── Config mode prompt ────────────────────────────────────────────────────────

if [[ -z "$CONFIG_MODE" ]] && [[ -d ".claude" ]]; then
  echo ""
  echo "How should .claude/ config be handled in the new workspace?"
  echo "  [1] copy    — independent copy (changes won't sync)"
  echo "  [2] symlink — shared config (changes reflect in both)"
  echo ""
  read -r -p "Enter choice [1/2] (default: 1): " CONFIG_CHOICE
  case "${CONFIG_CHOICE:-1}" in
    2|symlink) CONFIG_MODE="symlink" ;;
    *)         CONFIG_MODE="copy" ;;
  esac
elif [[ -z "$CONFIG_MODE" ]]; then
  CONFIG_MODE="copy"
fi

# ── Clone ─────────────────────────────────────────────────────────────────────

echo ""
echo "Creating workspace: $WORKSPACE_NAME"
echo "  Clone URL : $REMOTE_URL"
echo "  Path      : $WORKSPACE_PATH"
echo "  Branch    : $TARGET_BRANCH"
echo "  Config    : $CONFIG_MODE"
echo ""

echo "Cloning..."
git clone "$REMOTE_URL" "$WORKSPACE_PATH"

# Checkout target branch if different from default
CLONED_BRANCH="$(git -C "$WORKSPACE_PATH" rev-parse --abbrev-ref HEAD)"
if [[ "$TARGET_BRANCH" != "$CLONED_BRANCH" ]]; then
  echo "Checking out branch: $TARGET_BRANCH"
  git -C "$WORKSPACE_PATH" checkout "$TARGET_BRANCH" 2>/dev/null || \
    git -C "$WORKSPACE_PATH" checkout -b "$TARGET_BRANCH"
fi

# ── Copy / symlink .claude config ─────────────────────────────────────────────

if [[ -d ".claude" ]]; then
  # Replace the cloned .claude directory so the new workspace mirrors the
  # current repo's config choice, including any uncommitted local changes.
  rm -rf "$WORKSPACE_PATH/.claude"

  if [[ "$CONFIG_MODE" == "symlink" ]]; then
    ln -s "$(pwd)/.claude" "$WORKSPACE_PATH/.claude"
    echo "Symlinked .claude/ config"
  else
    # Copy but skip *.local.md (session-specific state files).
    mkdir -p "$WORKSPACE_PATH/.claude"
    (
      cd .claude
      tar --exclude='*.local.md' -cf - .
    ) | (
      cd "$WORKSPACE_PATH/.claude"
      tar -xf -
    )
    echo "Copied .claude/ config (excluded *.local.md)"
  fi
fi

# ── Record workspace in state file ───────────────────────────────────────────

mkdir -p .claude
STATE_FILE=".claude/multi-setup-workspaces.local.md"
CREATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Init state file if it doesn't exist
if [[ ! -f "$STATE_FILE" ]]; then
  cat > "$STATE_FILE" <<'EOF'
---
workspaces: []
---
EOF
fi

# Append workspace entry (simple append before closing ---)
ENTRY="  - name: \"$WORKSPACE_NAME\"\n    path: \"$WORKSPACE_PATH\"\n    branch: \"$TARGET_BRANCH\"\n    config: \"$CONFIG_MODE\"\n    created_at: \"$CREATED_AT\""

# Insert before the closing --- line
sed -i '' "/^---$/{ N; s/---\n---/---\n${ENTRY}\n---/; }" "$STATE_FILE" 2>/dev/null || true

# Fallback: just append the entry as plain markdown if sed failed
if ! grep -q "$WORKSPACE_NAME" "$STATE_FILE" 2>/dev/null; then
  printf "\n- name: %s\n  path: %s\n  branch: %s\n  config: %s\n  created_at: %s\n" \
    "$WORKSPACE_NAME" "$WORKSPACE_PATH" "$TARGET_BRANCH" "$CONFIG_MODE" "$CREATED_AT" >> "$STATE_FILE"
fi

# ── Open new terminal window ──────────────────────────────────────────────────

LAUNCH_STATUS="failed"

if [[ "$(uname)" == "Darwin" ]]; then
  # Try iTerm2 first, fall back to Terminal.app
  if osascript -e 'id of app "iTerm2"' &>/dev/null 2>&1; then
    osascript <<APPLE
tell application "iTerm2"
  create window with default profile command "cd '$WORKSPACE_PATH' && claude"
end tell
APPLE
    LAUNCH_STATUS="iTerm2"
  else
    osascript <<APPLE
tell application "Terminal"
  do script "cd '$WORKSPACE_PATH' && claude"
  activate
end tell
APPLE
    LAUNCH_STATUS="Terminal.app"
  fi
else
  # Linux fallback — print command for user to run
  LAUNCH_STATUS="manual"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════"
echo "  Workspace created successfully!"
echo "══════════════════════════════════════════════"
echo ""
echo "  Name    : $WORKSPACE_NAME"
echo "  Path    : $WORKSPACE_PATH"
echo "  Branch  : $TARGET_BRANCH"
echo "  Config  : $CONFIG_MODE"
echo ""

if [[ "$LAUNCH_STATUS" == "manual" ]]; then
  echo "  Run the following to open Claude Code in the new workspace:"
  echo ""
  echo "    cd '$WORKSPACE_PATH' && claude"
  echo ""
else
  echo "  Claude Code launched in: $LAUNCH_STATUS"
  echo ""
fi

echo "  Manage workspaces: /list-workspaces"
echo "══════════════════════════════════════════════"
