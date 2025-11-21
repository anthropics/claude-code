#!/usr/bin/env bash
# Mutation testing for bash scripts
# Tests the quality of tests by introducing mutations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TARGET_SCRIPT="${1:-$PROJECT_ROOT/.devcontainer/init-firewall.sh}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧬 Mutation Testing${NC}"
echo "==================="
echo ""
echo "Target: $(basename "$TARGET_SCRIPT")"
echo ""

if [ ! -f "$TARGET_SCRIPT" ]; then
  echo -e "${RED}Error: Target script not found${NC}"
  exit 1
fi

# Create temporary directory
MUTATION_DIR=$(mktemp -d)
trap 'rm -rf "$MUTATION_DIR"' EXIT

# Backup original script
cp "$TARGET_SCRIPT" "$MUTATION_DIR/original.sh"

# Define mutations to apply
declare -A mutations=(
  # String mutations
  ["ERROR"]="WARNING"
  ["ACCEPT"]="DROP"
  ["DROP"]="ACCEPT"

  # Logic mutations
  ["-z"]="! -z"
  ["-n"]="! -n"
  ["-eq 0"]="-ne 0"
  ["-ne 0"]="-eq 0"

  # Comparison mutations
  ["-gt"]="-lt"
  ["-lt"]="-gt"
  ["-ge"]="-le"
  ["-le"]="-ge"

  # Regex mutations (intentionally break validation)
  ["[0-9]{1,3}"]="[0-9]{1,5}"
  ["{1,2}"]={1,4}
)

total_mutations=0
killed_mutations=0
survived_mutations=0

echo "Running baseline tests..."
if ! bats "$PROJECT_ROOT/tests/unit/firewall/*.bats" > /dev/null 2>&1; then
  echo -e "${RED}❌ Baseline tests failing! Fix tests first.${NC}"
  exit 1
fi

echo -e "${GREEN}✓${NC} Baseline tests pass"
echo ""

echo "Applying mutations..."
echo ""

for original in "${!mutations[@]}"; do
  mutation="${mutations[$original]}"
  ((total_mutations++))

  echo -n "Mutation $total_mutations: '$original' → '$mutation' ... "

  # Create mutated version
  sed "s/$original/$mutation/g" "$MUTATION_DIR/original.sh" > "$TARGET_SCRIPT"

  # Run tests against mutated version
  if bats "$PROJECT_ROOT/tests/unit/firewall/*.bats" > /dev/null 2>&1; then
    # Tests passed - mutation survived (BAD)
    echo -e "${RED}SURVIVED${NC} ⚠️"
    ((survived_mutations++))
  else
    # Tests failed - mutation killed (GOOD)
    echo -e "${GREEN}KILLED${NC} ✓"
    ((killed_mutations++))
  fi

  # Restore original
  cp "$MUTATION_DIR/original.sh" "$TARGET_SCRIPT"
done

# Restore original script
cp "$MUTATION_DIR/original.sh" "$TARGET_SCRIPT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Mutation Testing Results"
echo "───────────────────────────"
echo ""
echo "Total mutations:    $total_mutations"
echo -e "${GREEN}Killed mutations:   $killed_mutations${NC}"
echo -e "${RED}Survived mutations: $survived_mutations${NC}"
echo ""

# Calculate mutation score
if [ $total_mutations -gt 0 ]; then
  mutation_score=$((killed_mutations * 100 / total_mutations))
  echo "Mutation Score: ${mutation_score}%"
  echo ""

  if [ $mutation_score -ge 80 ]; then
    echo -e "${GREEN}✨ Excellent test quality!${NC}"
  elif [ $mutation_score -ge 60 ]; then
    echo -e "${YELLOW}⚠️  Good, but could be better${NC}"
  else
    echo -e "${RED}❌ Tests need improvement${NC}"
  fi
fi

echo ""
echo "What is Mutation Testing?"
echo "────────────────────────"
echo "Mutation testing evaluates test quality by introducing"
echo "bugs (mutations) into code. If tests fail, the mutation"
echo "is 'killed' (good). If tests pass, the mutation 'survived'"
echo "(indicates test gaps)."
echo ""
echo "A high mutation score means your tests are effective at"
echo "catching bugs."
echo ""
