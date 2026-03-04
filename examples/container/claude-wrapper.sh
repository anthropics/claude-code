#!/usr/bin/env bash
# Launch Claude Code inside a Podman container (Podman only — uses --userns=keep-id
# and --passwd-entry which have no Docker equivalent).
# Place at ~/.claude/bin/claude and add ~/.claude/bin to PATH.
#
# Environment variables:
#   CLAUDE_DOCKER_IMAGE   - image name (default: claude-code)
#   CLAUDE_DOCKER_EXTRA   - extra podman args (space-separated)
#   CLAUDE_DOCKER_REBUILD - set to 1 to force image rebuild
#   CLAUDE_SECRETS_FILE   - path to env file with API keys (default: /tmp/claude-secrets.env)

set -euo pipefail

IMAGE="${CLAUDE_DOCKER_IMAGE:-claude-code}"
CLAUDE_HOME="$HOME/.claude"
DOCKER_DIR="${CLAUDE_HOME}/docker"
PODMAN="$(command -v podman || true)"
if [[ -z "$PODMAN" ]]; then
  echo "Error: podman is required (Docker is not supported — uses Podman-specific flags)." >&2
  echo "See README.md 'Docker (non-Podman) notes' for manual adaptation." >&2
  exit 1
fi

# --- Build image if needed ---
if [[ "${CLAUDE_DOCKER_REBUILD:-}" == "1" ]] || ! "$PODMAN" image inspect "$IMAGE" &>/dev/null; then
  echo "Building $IMAGE image..."
  "$PODMAN" build -t "$IMAGE" "$DOCKER_DIR"
fi

# --- Working directory ---
WORK_DIR="$(pwd)"
if git rev-parse --show-toplevel &>/dev/null; then
  WORK_DIR="$(git rev-parse --show-toplevel)"
fi

# --- Container settings overlay ---
CONTAINER_SETTINGS="$DOCKER_DIR/settings.container.json"
SETTINGS_TARGET="$(readlink -f "$CLAUDE_HOME/settings.json" 2>/dev/null || echo "$CLAUDE_HOME/settings.json")"

# --- Secrets ---
ENV_ARGS=()
SECRETS_FILE="${CLAUDE_SECRETS_FILE:-/tmp/claude-secrets.env}"
if [[ -f "$SECRETS_FILE" ]]; then
  while IFS='=' read -r key value; do
    key="${key#export }"
    value="${value#\"}"
    value="${value%\"}"
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    ENV_ARGS+=(-e "$key=$value")
  done < "$SECRETS_FILE"
fi

# --- SSH ---
SSH_ARGS=()
if [[ -n "${SSH_AUTH_SOCK:-}" ]]; then
  SSH_ARGS+=(-v "$SSH_AUTH_SOCK:/tmp/ssh-agent.sock" -e "SSH_AUTH_SOCK=/tmp/ssh-agent.sock")
fi
# 1Password agent
OP_AGENT="$HOME/.1password/agent.sock"
if [[ -S "$OP_AGENT" ]]; then
  SSH_ARGS+=(-v "$OP_AGENT:$OP_AGENT")
fi

# --- Find real claude binary (skip this wrapper) ---
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_BIN=""
IFS=: read -ra PATH_DIRS <<< "$PATH"
for dir in "${PATH_DIRS[@]}"; do
  [[ "$(cd "$dir" 2>/dev/null && pwd)" == "$SELF_DIR" ]] && continue
  if [[ -x "$dir/claude" ]]; then
    CLAUDE_BIN="$(readlink -f "$dir/claude")"
    break
  fi
done
if [[ -z "$CLAUDE_BIN" ]]; then
  echo "Error: could not find the real claude binary on PATH" >&2
  exit 1
fi
CLAUDE_VERSIONS_DIR="$(dirname "$CLAUDE_BIN")"

# --- Host binaries ---
BINARY_MOUNTS=(
  -v "$CLAUDE_VERSIONS_DIR:$CLAUDE_VERSIONS_DIR:ro"
  -v "$CLAUDE_BIN:/usr/local/bin/claude:ro"
)
GH_BIN="$(command -v gh 2>/dev/null || true)"
if [[ -n "$GH_BIN" ]]; then
  BINARY_MOUNTS+=(-v "$GH_BIN:/usr/local/bin/gh:ro")
fi

# --- Run ---
mkdir -p "$CLAUDE_HOME/rules"

exec "$PODMAN" run --rm -it --userns=keep-id \
  --cap-drop=ALL --security-opt=no-new-privileges \
  --passwd-entry "$(whoami):*:$(id -u):$(id -g)::$HOME:/bin/bash" \
  -v "$CLAUDE_HOME:$HOME/.claude" \
  -v "$CONTAINER_SETTINGS:$SETTINGS_TARGET:ro" \
  -v /dev/null:$HOME/.claude/settings.local.json:ro \
  -v "$DOCKER_DIR/container-rules.md:$HOME/.claude/rules/container.md:ro" \
  -v "$WORK_DIR:$WORK_DIR" \
  -w "$WORK_DIR" \
  -v "$HOME/.claude.json:$HOME/.claude.json" \
  -v "$HOME/.ssh:$HOME/.ssh:ro" \
  -v "$HOME/.gitconfig:$HOME/.gitconfig:ro" \
  -e "HOME=$HOME" \
  -e "TERM=$TERM" \
  -e "COLORTERM=${COLORTERM:-}" \
  --hostname "container" \
  "${BINARY_MOUNTS[@]}" \
  ${SSH_ARGS[@]+"${SSH_ARGS[@]}"} \
  ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} \
  ${CLAUDE_DOCKER_EXTRA:-} \
  "$IMAGE" sh -c 'exec claude --dangerously-skip-permissions "$@"' -- "$@"
