#!/usr/bin/env bash
# Shell wrapper around the Python runner — matches the project's
# convention for plugin tests (see plugins/feature-dev/...).
#
# Usage:
#   ./run_scenario.sh multi-file-rename
#   ./run_scenario.sh --all
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "${HERE}/run_scenario.py" "$@"
