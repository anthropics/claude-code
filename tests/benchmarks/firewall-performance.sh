#!/usr/bin/env bash
# Performance benchmarks for firewall initialization

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 Firewall Script Performance Benchmarks"
echo "=========================================="
echo ""

# Function to measure execution time
benchmark() {
  local name="$1"
  local command="$2"
  local iterations="${3:-10}"

  echo -e "${BLUE}Benchmarking: $name${NC}"
  echo "Iterations: $iterations"

  local total=0
  local min=999999
  local max=0

  for ((i=1; i<=iterations; i++)); do
    local start=$(date +%s%N)
    eval "$command" > /dev/null 2>&1 || true
    local end=$(date +%s%N)
    local duration=$(( (end - start) / 1000000 )) # Convert to milliseconds

    total=$((total + duration))

    if [ "$duration" -lt "$min" ]; then
      min=$duration
    fi

    if [ "$duration" -gt "$max" ]; then
      max=$duration
    fi

    echo -n "."
  done

  echo ""

  local avg=$((total / iterations))

  echo -e "  ${GREEN}Average: ${avg}ms${NC}"
  echo -e "  Min: ${min}ms"
  echo -e "  Max: ${max}ms"
  echo ""
}

# Test 1: CIDR validation performance
echo "📊 Test 1: CIDR Validation"
benchmark "Valid CIDR validation" \
  'if [[ "192.168.1.0/24" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then true; fi' \
  1000

# Test 2: IP validation performance
echo "📊 Test 2: IP Validation"
benchmark "Valid IP validation" \
  'if [[ "192.168.1.1" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then true; fi' \
  1000

# Test 3: Script syntax check
echo "📊 Test 3: Script Syntax Check"
benchmark "Bash syntax check" \
  "bash -n $PROJECT_ROOT/.devcontainer/init-firewall.sh" \
  50

# Test 4: JSON parsing performance
echo "📊 Test 4: JSON Parsing"
if [ -f "$PROJECT_ROOT/tests/fixtures/github-meta-response.json" ]; then
  benchmark "jq parsing GitHub meta" \
    "jq -r '.web[]' $PROJECT_ROOT/tests/fixtures/github-meta-response.json" \
    100
fi

# Test 5: Multiple validations in sequence
echo "📊 Test 5: Batch Validation"
benchmark "100 CIDR validations" \
  'for i in {1..100}; do [[ "192.168.$((i % 256)).0/24" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; done' \
  10

# Test 6: String operations
echo "📊 Test 6: String Operations"
benchmark "String extraction" \
  'echo "192.168.1.1" | cut -d"." -f1' \
  1000

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}✅ Benchmark Suite Complete${NC}"
echo ""
echo "Performance Notes:"
echo "  • Regex validation: < 1ms per operation"
echo "  • JSON parsing: ~10-20ms for typical responses"
echo "  • Script validation: ~50-100ms"
echo ""
echo "Recommended Performance Targets:"
echo "  • CIDR/IP validation: < 1ms"
echo "  • Full script execution: < 5 seconds"
echo "  • GitHub API call: < 500ms"
echo "  • DNS resolution: < 100ms per domain"
