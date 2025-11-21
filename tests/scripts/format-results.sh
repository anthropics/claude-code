#!/usr/bin/env bash
# Format test results with beautiful output

set -euo pipefail

# Colors and formatting
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Unicode symbols
CHECK="✓"
CROSS="✗"
STAR="★"
ROCKET="🚀"
FIRE="🔥"
TROPHY="🏆"
TARGET="🎯"
CHART="📊"
SPARKLES="✨"

# Function to print header
print_header() {
  local title="$1"
  echo ""
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${CYAN}  ${ROCKET} $title${NC}"
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# Function to print section
print_section() {
  local title="$1"
  echo ""
  echo -e "${BOLD}${MAGENTA}▸ $title${NC}"
  echo -e "${DIM}$(printf '─%.0s' {1..60})${NC}"
}

# Function to print success
print_success() {
  local message="$1"
  echo -e "${GREEN}  ${CHECK} $message${NC}"
}

# Function to print failure
print_failure() {
  local message="$1"
  echo -e "${RED}  ${CROSS} $message${NC}"
}

# Function to print info
print_info() {
  local message="$1"
  echo -e "${BLUE}  ℹ $message${NC}"
}

# Function to print warning
print_warning() {
  local message="$1"
  echo -e "${YELLOW}  ⚠ $message${NC}"
}

# Function to create progress bar
progress_bar() {
  local current="$1"
  local total="$2"
  local width=40
  local percentage=$((current * 100 / total))
  local filled=$((width * current / total))
  local empty=$((width - filled))

  printf "  ["
  printf "${GREEN}%0.s█${NC}" $(seq 1 $filled)
  printf "${DIM}%0.s░${NC}" $(seq 1 $empty)
  printf "] %3d%% (%d/%d)\n" "$percentage" "$current" "$total"
}

# Main test runner with formatted output
run_formatted_tests() {
  local test_dir="${1:-tests}"

  print_header "Claude Code Test Suite"

  # Find all test files
  mapfile -t test_files < <(find "$test_dir" -name "*.bats" -type f 2>/dev/null)
  local total=${#test_files[@]}

  if [ $total -eq 0 ]; then
    print_failure "No test files found in $test_dir"
    exit 1
  fi

  print_section "Test Discovery"
  print_info "Found $total test files"
  echo ""

  # Run tests
  print_section "Running Tests"
  echo ""

  local passed=0
  local failed=0
  local current=0

  for test_file in "${test_files[@]}"; do
    ((current++))
    local name=$(basename "$test_file" .bats)

    # Run test
    if bats "$test_file" > /dev/null 2>&1; then
      ((passed++))
      print_success "$name"
    else
      ((failed++))
      print_failure "$name"
    fi

    # Show progress
    if [ $((current % 5)) -eq 0 ] || [ $current -eq $total ]; then
      echo ""
      progress_bar $current $total
      echo ""
    fi
  done

  # Results summary
  print_section "Results Summary"
  echo ""

  local success_rate=$((passed * 100 / total))

  echo -e "  ${BOLD}Total Tests:${NC}    $total"
  echo -e "  ${GREEN}${BOLD}Passed:${NC}         $passed"

  if [ $failed -gt 0 ]; then
    echo -e "  ${RED}${BOLD}Failed:${NC}         $failed"
  else
    echo -e "  ${DIM}Failed:${NC}         $failed"
  fi

  echo ""
  echo -e "  ${BOLD}Success Rate:${NC}   ${success_rate}%"
  echo ""

  # Visual indicator
  if [ $success_rate -eq 100 ]; then
    echo -e "${GREEN}${BOLD}  ${SPARKLES}${TROPHY} PERFECT SCORE! All tests passed! ${TROPHY}${SPARKLES}${NC}"
  elif [ $success_rate -ge 90 ]; then
    echo -e "${GREEN}${BOLD}  ${FIRE} Excellent! Almost perfect! ${FIRE}${NC}"
  elif [ $success_rate -ge 75 ]; then
    echo -e "${YELLOW}${BOLD}  ${TARGET} Good! Some work needed ${TARGET}${NC}"
  else
    echo -e "${RED}${BOLD}  ${CROSS} Needs attention ${CROSS}${NC}"
  fi

  echo ""

  # Footer
  echo -e "${DIM}$(printf '─%.0s' {1..60})${NC}"
  echo -e "${DIM}  Generated at $(date '+%Y-%m-%d %H:%M:%S')${NC}"
  echo ""

  # Exit code
  if [ $failed -gt 0 ]; then
    return 1
  fi

  return 0
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
  run_formatted_tests "${1:-tests}"
fi
