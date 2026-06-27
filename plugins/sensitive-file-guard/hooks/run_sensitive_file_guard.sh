#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SCRIPT="${SCRIPT_DIR}/sensitive_file_guard_hook.py"

if command -v python3 >/dev/null 2>&1; then
  exec python3 "$HOOK_SCRIPT"
fi

if command -v python >/dev/null 2>&1; then
  exec python "$HOOK_SCRIPT"
fi

if command -v py >/dev/null 2>&1; then
  exec py -3 "$HOOK_SCRIPT"
fi

echo "Sensitive File Guard requires Python 3, but no compatible interpreter was found." >&2
exit 1
