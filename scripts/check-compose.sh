#!/usr/bin/env bash
set -euo pipefail

# check-compose.sh — print-only helper (no execution)
# This script DOES NOT run podman-compose. It prints the exact commands
# you can run later to dry-run the merged compose config.

ROOT="${1:-$(pwd)}"
CORE="${ROOT}/eos/compose/core.podman.yml"
RUNTIME="${ROOT}/eos/compose/runtime.podman.yml"

echo "==> check-compose.sh (print-only)"
echo "Repo root: ${ROOT}"
echo

missing=0
if [ ! -f "${CORE}" ]; then
  echo "❌ Missing: ${CORE}"; missing=$((missing+1))
else
  echo "✅ Found:   ${CORE}"
fi
if [ ! -f "${RUNTIME}" ]; then
  echo "⚠️  Optional overlay missing (ok for now): ${RUNTIME}"
else
  echo "✅ Found:   ${RUNTIME}"
fi
echo

if [ "${missing}" -gt 0 ]; then
  echo "Aborting print: required files missing."
  exit 1
fi

echo "==> Dry-run commands (copy/paste when you're ready)"
echo

echo "# Core only:"
echo "podman-compose -f ${CORE} config"
echo

echo "# Core + runtime overlay:"
echo "podman-compose -f ${CORE} -f ${RUNTIME} config"
echo

echo "Notes:"
echo "- These commands ONLY render the merged config. They do not start services."
echo "- Ensure host ports (3510–3517, 3434, 3000, 3521, 3522, and 8080 for app) are free before a real 'up'."
echo "- Each service should bind /app/config/agent.yaml:ro and mount /app/data (state.db)."
