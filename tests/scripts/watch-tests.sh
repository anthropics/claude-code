#!/usr/bin/env bash
# Watch mode for continuous test execution during development

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration
WATCH_PATHS=(
  "$PROJECT_ROOT/.devcontainer"
  "$PROJECT_ROOT/.github"
  "$PROJECT_ROOT/tests"
)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

clear

echo -e "${BLUE}🔍 Test Watch Mode${NC}"
echo "=================="
echo ""
echo "Watching for changes in:"
for path in "${WATCH_PATHS[@]}"; do
  echo "  • $(basename "$path")"
done
echo ""
echo "Press Ctrl+C to exit"
echo ""

# Function to run tests
run_tests() {
  clear
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}🧪 Running tests... ($(date +%H:%M:%S))${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  if bats "$PROJECT_ROOT/tests/unit/**/*.bats"; then
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
  else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed${NC}"
  fi

  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "Waiting for changes..."
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Initial test run
run_tests

# Watch for changes
if command -v inotifywait >/dev/null 2>&1; then
  # Linux with inotify
  while true; do
    inotifywait -r -e modify,create,delete "${WATCH_PATHS[@]}" 2>/dev/null
    sleep 0.5  # Debounce
    run_tests
  done
elif command -v fswatch >/dev/null 2>&1; then
  # macOS with fswatch
  fswatch -o "${WATCH_PATHS[@]}" | while read -r; do
    run_tests
  done
else
  # Fallback: polling
  echo "⚠️  Install inotifywait (Linux) or fswatch (macOS) for better performance"
  echo ""

  last_mod_time=""

  while true; do
    sleep 2

    # Get latest modification time
    current_mod_time=$(find "${WATCH_PATHS[@]}" -type f \( -name "*.bats" -o -name "*.sh" -o -name "*.yml" \) -printf "%T@ %p\n" 2>/dev/null | sort -rn | head -1 | cut -d' ' -f1)

    if [ "$current_mod_time" != "$last_mod_time" ] && [ -n "$current_mod_time" ]; then
      last_mod_time="$current_mod_time"
      run_tests
    fi
  done
fi
