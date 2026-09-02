#!/usr/bin/env bash

set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  echo "usage-monitor only supports macOS because it installs a SwiftBar plugin." >&2
  exit 1
fi

TRUSTED_DIR="$PWD"
REFRESH_MINUTES="5"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --trusted-dir)
      TRUSTED_DIR="${2:?missing value for --trusted-dir}"
      shift 2
      ;;
    --refresh-minutes)
      REFRESH_MINUTES="${2:?missing value for --refresh-minutes}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if ! [[ "$REFRESH_MINUTES" =~ ^[0-9]+$ ]] || [ "$REFRESH_MINUTES" -le 0 ]; then
  echo "--refresh-minutes must be a positive integer." >&2
  exit 1
fi

if [ ! -d "$TRUSTED_DIR" ]; then
  echo "Trusted directory does not exist: $TRUSTED_DIR" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Missing dependency: jq. Install it with 'brew install jq'." >&2
  exit 1
fi

if ! command -v script >/dev/null 2>&1; then
  echo "Missing dependency: script (part of macOS)." >&2
  exit 1
fi

TARGET_DIR="$HOME/.claude/plugins/usage-monitor"
SWIFTBAR_DIR="$HOME/Library/Application Support/SwiftBar/Plugins"
PLUGIN_SOURCE_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"

mkdir -p "$TARGET_DIR" "$SWIFTBAR_DIR"

cp "$PLUGIN_SOURCE_DIR/claude-usage-fetch.sh" "$TARGET_DIR/claude-usage-fetch.sh"
cp "$PLUGIN_SOURCE_DIR/claude-usage.1m.sh" "$TARGET_DIR/claude-usage.1m.sh"
chmod +x "$TARGET_DIR/claude-usage-fetch.sh" "$TARGET_DIR/claude-usage.1m.sh"

cat >"$TARGET_DIR/config.env" <<EOF
CLAUDE_USAGE_MONITOR_TRUSTED_DIR=${TRUSTED_DIR}
CLAUDE_USAGE_MONITOR_REFRESH_MINUTES=${REFRESH_MINUTES}
CLAUDE_USAGE_MONITOR_CACHE_FILE=${TARGET_DIR}/cache.json
CLAUDE_USAGE_MONITOR_SESSION_FILE=${TARGET_DIR}/session.txt
CLAUDE_USAGE_MONITOR_LOCK_FILE=${TARGET_DIR}/fetch.lock
EOF

ln -sf "$TARGET_DIR/claude-usage.1m.sh" "$SWIFTBAR_DIR/claude-usage.1m.sh"

cat <<EOF
Installed usage-monitor.

Files:
- SwiftBar plugin: $SWIFTBAR_DIR/claude-usage.1m.sh
- Runtime directory: $TARGET_DIR
- Trusted directory: $TRUSTED_DIR

Next steps:
1. Install SwiftBar if needed: brew install --cask swiftbar
2. Start or refresh SwiftBar
3. Click "Refresh now" in the menu once to seed the initial cache
EOF
