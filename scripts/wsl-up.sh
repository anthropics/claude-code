#!/usr/bin/env bash
# wsl-up.sh — bring up the forked Claude Code devcontainer from a WSL terminal.
#
# Detects the invoking WSL user's identity, writes .env if missing, then builds
# and starts the container and drops you into a shell inside it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

# Pull latest fork changes before building. Skip if the tree is dirty so
# local edits aren't disturbed. Set WSL_UP_NO_PULL=1 to bypass.
if [[ "${WSL_UP_NO_PULL:-0}" != "1" ]]; then
  cd "$REPO_ROOT"
  if [[ -z "$(git status --porcelain)" ]]; then
    branch="$(git rev-parse --abbrev-ref HEAD)"
    echo ">> git pull --ff-only origin $branch"
    git pull --ff-only origin "$branch" || \
      echo ">> Pull failed (non-fast-forward or network). Continuing with local HEAD."
  else
    echo ">> Working tree has local changes; skipping git pull."
  fi
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo ">> No .env found; generating one from your WSL identity..."
  cat > "$ENV_FILE" <<EOF
HOST_USER=$USER
HOST_UID=$(id -u)
HOST_GID=$(id -g)
HOST_HOME=$HOME
EOF
  echo ">> Wrote $ENV_FILE:"
  sed 's/^/   /' "$ENV_FILE"
else
  echo ">> Reusing existing $ENV_FILE"
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

cd "$REPO_ROOT"
echo ">> docker compose up -d --build"
docker compose up -d --build

CONTAINER="claude-${HOST_USER}"
SENTINEL="/home/${HOST_USER}/.claude/.fnba-bootstrap-done"

if ! docker exec "$CONTAINER" test -f "$SENTINEL"; then
  echo ">> First-time setup detected; running bootstrap inside $CONTAINER..."
  docker exec -it "$CONTAINER" bash /opt/fnba-bootstrap/first-time-setup.sh
fi

echo ">> Attaching to $CONTAINER..."
exec docker exec -it "$CONTAINER" bash
