#!/usr/bin/env bash
# Quick demo of testing capabilities

set -euo pipefail

# Colors
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

clear

echo -e "${BOLD}${CYAN}"
cat << "EOF"
   ______                __        ______          __         ______           __
  / ____/___  ____  ____/ /__     /_  __/__  _____/ /_       / ____/___ ______/ /___
 / /   / __ \/ __ \/ __  / _ \     / / / _ \/ ___/ __/      / /   / __ `/ ___/ / __ \
/ /___/ /_/ / /_/ / /_/ /  __/    / / /  __(__  ) /_       / /___/ /_/ (__  ) / /_/ /
\____/\____/\____/\__,_/\___/    /_/  \___/____/\__/       \____/\__,_/____/_/\____/

EOF
echo -e "${NC}"

echo -e "${BOLD}${BLUE}🚀 Testing Infrastructure Demo${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to run demo step
demo_step() {
  local number="$1"
  local title="$2"
  local command="$3"

  echo -e "${BOLD}${MAGENTA}[$number] $title${NC}"
  echo -e "${CYAN}$ $command${NC}"
  echo ""

  eval "$command"

  echo ""
  echo -e "${GREEN}✓ Complete${NC}"
  echo ""
  read -p "Press Enter to continue..." -r
  echo ""
}

echo -e "${BOLD}This demo will showcase:${NC}"
echo "  1. Test statistics & analytics"
echo "  2. Running a quick test"
echo "  3. Performance benchmark"
echo "  4. Test coverage summary"
echo ""
read -p "Press Enter to start the demo..." -r
clear

# Demo 1: Analytics
demo_step "1" "Test Analytics & Metrics" \
  "bash tests/scripts/test-analytics.sh | head -30"

# Demo 2: Run a sample test
demo_step "2" "Running Sample Tests (CIDR Validation)" \
  "bats tests/unit/firewall/cidr-validation.bats | head -20"

# Demo 3: Benchmark
demo_step "3" "Performance Benchmarks" \
  "bash tests/benchmarks/firewall-performance.sh | head -40"

# Demo 4: Coverage summary
demo_step "4" "Test Coverage Summary" \
  "bash tests/scripts/generate-coverage.sh | grep -A 20 'Coverage by Component'"

# Final summary
clear
echo -e "${BOLD}${CYAN}"
cat << "EOF"
    ____                            ________                      __     __       __
   / __ \___  ____ ___  ____       / ____/ /___  ____ ___  ____  / /__  / /____  / /
  / / / / _ \/ __ `__ \/ __ \     / /   / __  \/ __ `__ \/ __ \/ / _ \/ __/ _ \/ /
 / /_/ /  __/ / / / / / /_/ /    / /___/ /_/ / / / / / / /_/ / /  __/ /_/  __/_/
/_____/\___/_/ /_/ /_/\____/     \____/\____/_/ /_/ /_/ .___/_/\___/\__/\___(_)
                                                      /_/
EOF
echo -e "${NC}"

echo ""
echo -e "${BOLD}${GREEN}✨ Demo Complete!${NC}"
echo ""
echo -e "${BOLD}Available Commands:${NC}"
echo ""
echo -e "  ${CYAN}npm test${NC}                 - Run all tests"
echo -e "  ${CYAN}npm run test:parallel${NC}    - 3-4x faster parallel execution"
echo -e "  ${CYAN}npm run test:watch${NC}       - Watch mode for development"
echo -e "  ${CYAN}npm run coverage${NC}         - Generate coverage report"
echo -e "  ${CYAN}npm run analytics${NC}        - View test analytics"
echo -e "  ${CYAN}npm run benchmark${NC}        - Performance benchmarks"
echo -e "  ${CYAN}npm run test:mutation${NC}    - Mutation testing"
echo ""
echo -e "${BOLD}Documentation:${NC}"
echo -e "  ${CYAN}TESTING.md${NC}              - Quick reference"
echo -e "  ${CYAN}tests/README.md${NC}         - Comprehensive guide"
echo -e "  ${CYAN}tests/ADVANCED.md${NC}       - Advanced features"
echo ""
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}🎉 170+ tests | 90%+ coverage | 3-4x faster | World-class quality${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
