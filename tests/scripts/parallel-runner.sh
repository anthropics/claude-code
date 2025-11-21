#!/usr/bin/env bash
# Parallel test execution runner

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration
MAX_PARALLEL="${MAX_PARALLEL:-4}"
TEST_DIR="${1:-$PROJECT_ROOT/tests}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🚀 Parallel Test Runner"
echo "======================="
echo "Max parallel jobs: $MAX_PARALLEL"
echo "Test directory: $TEST_DIR"
echo ""

# Find all test files
mapfile -t test_files < <(find "$TEST_DIR" -name "*.bats" -type f)

if [ ${#test_files[@]} -eq 0 ]; then
  echo "❌ No test files found"
  exit 1
fi

echo "Found ${#test_files[@]} test files"
echo ""

# Create temporary directory for results
RESULTS_DIR=$(mktemp -d)
trap 'rm -rf "$RESULTS_DIR"' EXIT

# Function to run a test file
run_test_file() {
  local test_file="$1"
  local index="$2"
  local output_file="$RESULTS_DIR/test_$index.out"

  local start_time=$(date +%s)

  if bats "$test_file" > "$output_file" 2>&1; then
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo "✅:$test_file:${duration}s" > "$output_file.status"
  else
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo "❌:$test_file:${duration}s" > "$output_file.status"
  fi
}

export -f run_test_file
export RESULTS_DIR

# Run tests in parallel
echo "⚡ Running tests in parallel..."
echo ""

if command -v parallel >/dev/null 2>&1; then
  # Use GNU parallel if available
  printf '%s\n' "${test_files[@]}" | \
    parallel -j "$MAX_PARALLEL" --line-buffer --bar \
    'run_test_file {} {#}'
else
  # Fallback to simple background jobs
  job_count=0
  for i in "${!test_files[@]}"; do
    run_test_file "${test_files[$i]}" "$i" &

    ((job_count++))

    if [ $job_count -ge "$MAX_PARALLEL" ]; then
      wait -n
      ((job_count--))
    fi
  done

  # Wait for remaining jobs
  wait
fi

echo ""
echo "📊 Results"
echo "=========="

# Collect and display results
total=0
passed=0
failed=0
total_duration=0

for status_file in "$RESULTS_DIR"/*.status; do
  if [ -f "$status_file" ]; then
    IFS=':' read -r status test_file duration < "$status_file"

    ((total++))

    if [ "$status" = "✅" ]; then
      ((passed++))
      echo -e "${GREEN}$status${NC} $(basename "$test_file") (${duration})"
    else
      ((failed++))
      echo -e "${RED}$status${NC} $(basename "$test_file") (${duration})"

      # Show failed test output
      output_file="${status_file%.status}.out"
      if [ -f "$output_file" ]; then
        echo "  Output:"
        sed 's/^/    /' "$output_file" | tail -20
      fi
    fi

    # Extract duration number
    duration_num=${duration%s}
    total_duration=$((total_duration + duration_num))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Summary:"
echo "  Total:    $total"
echo -e "  ${GREEN}Passed:   $passed${NC}"
if [ $failed -gt 0 ]; then
  echo -e "  ${RED}Failed:   $failed${NC}"
else
  echo "  Failed:   $failed"
fi
echo "  Duration: ${total_duration}s"
echo ""

# Calculate success rate
if [ $total -gt 0 ]; then
  success_rate=$((passed * 100 / total))
  echo "Success rate: ${success_rate}%"

  if [ $success_rate -eq 100 ]; then
    echo -e "${GREEN}✨ All tests passed!${NC}"
  elif [ $success_rate -ge 80 ]; then
    echo -e "${YELLOW}⚠️  Some tests failed${NC}"
  else
    echo -e "${RED}❌ Many tests failed${NC}"
  fi
fi

echo ""

# Exit with error if any tests failed
if [ $failed -gt 0 ]; then
  exit 1
fi

exit 0
