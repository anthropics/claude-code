#!/bin/bash
# Comprehensive Test Suite for Security Guidance Plugin
# Tests both security_reminder_hook.py and git_pre_commit_hook.py

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_HELPER="$(cd "$SCRIPT_DIR/../../plugin-dev/skills/hook-development/scripts" && pwd)/test-hook.sh"

# Hooks to test
SECURITY_REMINDER_HOOK="$PLUGIN_ROOT/hooks/security_reminder_hook.py"
GIT_PRE_COMMIT_HOOK="$PLUGIN_ROOT/hooks/git_pre_commit_hook.py"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Security Guidance Plugin - TDD Test Suite${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Testing hooks:"
echo "  1. security_reminder_hook.py (Edit/Write warnings)"
echo "  2. git_pre_commit_hook.py (Git commit blocking)"
echo ""

# Setup function
setup_test_repos() {
    echo -e "${YELLOW}Setting up test repositories...${NC}"

    # Clean up old test repos
    rm -rf /tmp/test-git-repo /tmp/test-git-repo-clean

    # Create test repo with secrets
    mkdir -p /tmp/test-git-repo
    cd /tmp/test-git-repo
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    # Create file with secrets and stage it
    cat > config.py << 'EOF'
import os

# DANGER: Hardcoded credentials
AZURE_API_KEY = "2a48df168ba44526a8f3cf71ae280d3f"
OPENAI_API_KEY = "sk-proj-abcd1234567890"
AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

# Azure connection string
STORAGE_CONNECTION = "DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=abcdefghijklmnopqrstuvwxyz0123456789+/ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/ABCDEFGHIJKLMNOPQ=="

# Database URL
DATABASE_URL = "postgresql://admin:secret123@localhost:5432/mydb"
EOF

    git add config.py

    # Create clean test repo
    mkdir -p /tmp/test-git-repo-clean
    cd /tmp/test-git-repo-clean
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    # Create file WITHOUT secrets
    cat > config.py << 'EOF'
import os

# Safe: Using environment variables
AZURE_API_KEY = os.getenv("AZURE_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

# Safe: Environment-based connection
STORAGE_CONNECTION = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
DATABASE_URL = os.getenv("DATABASE_URL")
EOF

    git add config.py

    cd "$SCRIPT_DIR"
    echo -e "${GREEN}✓ Test repositories created${NC}"
    echo ""
}

# Run a single test
run_test() {
    local test_name="$1"
    local hook_script="$2"
    local test_input="$3"
    local expected_exit_code="$4"
    local description="$5"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Test $TOTAL_TESTS: $test_name${NC}"
    echo "Description: $description"
    echo "Expected exit code: $expected_exit_code"
    echo ""

    # Set up environment
    export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"
    export ENABLE_SECURITY_REMINDER=1

    # Run the test
    set +e
    output=$(cat "$test_input" | python3 "$hook_script" 2>&1)
    actual_exit_code=$?
    set -e

    # Check result
    if [ "$actual_exit_code" -eq "$expected_exit_code" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        echo "   Exit code: $actual_exit_code (expected: $expected_exit_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "   Exit code: $actual_exit_code (expected: $expected_exit_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    # Show output if there was any
    if [ -n "$output" ]; then
        echo ""
        echo "Hook output:"
        echo "$output" | head -20
    fi

    echo ""
}

# Cleanup function
cleanup() {
    rm -rf /tmp/test-git-repo /tmp/test-git-repo-clean
    # Clean up session-specific state files
    rm -f ~/.claude/security_warnings_state_test-session-*.json
}

# Main test execution
main() {
    # Setup
    setup_test_repos

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  PART 1: Testing security_reminder_hook.py (Edit/Write)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Test 1: Edit hook should BLOCK file with hardcoded API keys
    run_test \
        "Edit Hook - Hardcoded API Keys" \
        "$SECURITY_REMINDER_HOOK" \
        "$SCRIPT_DIR/test-edit-with-api-key.json" \
        2 \
        "Should block when writing file with AZURE_API_KEY and OPENAI_API_KEY"

    # Test 2: Edit hook should ALLOW clean file
    run_test \
        "Edit Hook - Clean File" \
        "$SECURITY_REMINDER_HOOK" \
        "$SCRIPT_DIR/test-edit-clean-file.json" \
        0 \
        "Should allow when writing file with env vars (no hardcoded secrets)"

    # Test 3: Edit hook should BLOCK Azure connection string
    run_test \
        "Edit Hook - Azure Connection String" \
        "$SECURITY_REMINDER_HOOK" \
        "$SCRIPT_DIR/test-edit-with-azure-connection.json" \
        2 \
        "Should block when editing file to add Azure connection string"

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  PART 2: Testing git_pre_commit_hook.py (Git Commit)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Test 4: Git hook should BLOCK commit with secrets
    run_test \
        "Git Hook - Block Commit with Secrets" \
        "$GIT_PRE_COMMIT_HOOK" \
        "$SCRIPT_DIR/test-git-commit-with-secrets.json" \
        2 \
        "Should block git commit when staged files contain secrets"

    # Test 5: Git hook should ALLOW clean commit
    run_test \
        "Git Hook - Allow Clean Commit" \
        "$GIT_PRE_COMMIT_HOOK" \
        "$SCRIPT_DIR/test-git-commit-clean.json" \
        0 \
        "Should allow git commit when staged files are clean"

    # Test 6: Git hook should IGNORE non-git bash commands
    run_test \
        "Git Hook - Ignore Non-Git Commands" \
        "$GIT_PRE_COMMIT_HOOK" \
        "$SCRIPT_DIR/test-bash-non-git.json" \
        0 \
        "Should allow non-git bash commands (like 'ls -la')"

    # Summary
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  TEST SUMMARY${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Total tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    echo ""

    if [ "$FAILED_TESTS" -eq 0 ]; then
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}  ✅ ALL TESTS PASSED!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "The security hooks are working correctly:"
        echo "  ✓ Edit/Write hook warns about secrets in file edits"
        echo "  ✓ Git commit hook blocks commits with secrets"
        echo "  ✓ Both hooks allow clean code to pass through"
        echo ""
        echo "This PR is ready for submission with full TDD coverage."
        cleanup
        exit 0
    else
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}  ❌ SOME TESTS FAILED${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        cleanup
        exit 1
    fi
}

# Handle Ctrl+C
trap cleanup EXIT

# Run tests
main
