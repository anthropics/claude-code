#!/data/data/com.termux/files/usr/bin/bash

# ============================================
# TERMUX DEPLOYMENT SCRIPT - VALIDATOR
# ============================================
# This script validates your environment before
# running the full deployment script.
#
# Usage: ./test-deployment.sh
# ============================================

set -e

# Colors
G='\033[0;32m' # Green
Y='\033[1;33m' # Yellow
B='\033[0;34m' # Blue
C='\033[0;36m' # Cyan
R='\033[0;31m' # Red
NC='\033[0m'   # No Color

# Results tracking
PASSED=0
FAILED=0
WARNINGS=0

echo "╔════════════════════════════════════════════════════════╗"
echo "║                                                        ║"
echo "║    🧪 DEPLOYMENT ENVIRONMENT VALIDATOR 🧪            ║"
echo "║                                                        ║"
echo "║  Validates your system before deployment             ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Helper functions
pass() {
    echo -e "${G}✅ PASS${NC}: $1"
    ((PASSED++))
}

fail() {
    echo -e "${R}❌ FAIL${NC}: $1"
    echo -e "${Y}   Fix: $2${NC}"
    ((FAILED++))
}

warn() {
    echo -e "${Y}⚠️  WARN${NC}: $1"
    echo -e "${C}   Tip: $2${NC}"
    ((WARNINGS++))
}

info() {
    echo -e "${C}ℹ️  INFO${NC}: $1"
}

# ============================================
# TEST 1: Environment Check
# ============================================

echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}📱 TEST 1: Environment Check${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if running in Termux
if [[ -d "/data/data/com.termux" ]]; then
    pass "Running in Termux environment"
else
    warn "Not running in Termux" "Script is designed for Termux but may work on other systems"
fi

# Check bash version
BASH_VERSION_NUM=$(echo $BASH_VERSION | cut -d. -f1)
if [[ $BASH_VERSION_NUM -ge 4 ]]; then
    pass "Bash version: $BASH_VERSION"
else
    fail "Bash version too old: $BASH_VERSION" "Update Termux: pkg upgrade bash"
fi

# Check available disk space
AVAILABLE_SPACE=$(df -h $HOME | awk 'NR==2 {print $4}')
AVAILABLE_MB=$(df -m $HOME | awk 'NR==2 {print $4}')
if [[ $AVAILABLE_MB -gt 500 ]]; then
    pass "Disk space available: $AVAILABLE_SPACE"
else
    fail "Insufficient disk space: $AVAILABLE_SPACE" "Need at least 500MB. Run: pkg clean"
fi

# Check memory
if command -v free &> /dev/null; then
    TOTAL_MEM=$(free -m | awk 'NR==2 {print $2}')
    AVAILABLE_MEM=$(free -m | awk 'NR==2 {print $7}')
    if [[ $AVAILABLE_MEM -gt 200 ]]; then
        pass "Available memory: ${AVAILABLE_MEM}MB"
    else
        warn "Low memory: ${AVAILABLE_MEM}MB" "Close other apps to free up memory"
    fi
else
    info "Memory check skipped (free command not available)"
fi

echo ""

# ============================================
# TEST 2: Required Commands
# ============================================

echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}🔧 TEST 2: Required Commands${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1 | tr -d 'v')
    if [[ $NODE_MAJOR -ge 18 ]]; then
        pass "Node.js installed: $NODE_VERSION"
    else
        fail "Node.js version too old: $NODE_VERSION" "Update: pkg upgrade nodejs"
    fi
else
    fail "Node.js not installed" "Install: pkg install nodejs"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    pass "npm installed: v$NPM_VERSION"
else
    fail "npm not installed" "Install Node.js which includes npm: pkg install nodejs"
fi

# Check Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    pass "Git installed: v$GIT_VERSION"
else
    fail "Git not installed" "Install: pkg install git"
fi

# Check OpenSSL
if command -v openssl &> /dev/null; then
    OPENSSL_VERSION=$(openssl version | cut -d' ' -f2)
    pass "OpenSSL installed: $OPENSSL_VERSION"
else
    fail "OpenSSL not installed" "Install: pkg install openssl"
fi

# Check curl
if command -v curl &> /dev/null; then
    pass "curl installed"
else
    warn "curl not installed" "Optional but useful: pkg install curl"
fi

# Check wget
if command -v wget &> /dev/null; then
    pass "wget installed"
else
    warn "wget not installed" "Optional but useful: pkg install wget"
fi

echo ""

# ============================================
# TEST 3: Network Connectivity
# ============================================

echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}🌐 TEST 3: Network Connectivity${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check internet connectivity
if ping -c 1 -W 3 8.8.8.8 &> /dev/null; then
    pass "Internet connectivity (ping)"
else
    fail "No internet connection" "Check WiFi/mobile data and try again"
fi

# Check DNS resolution
if ping -c 1 -W 3 google.com &> /dev/null; then
    pass "DNS resolution working"
else
    fail "DNS not working" "Check network settings or try different network"
fi

# Test GitHub connectivity
if command -v curl &> /dev/null; then
    if curl -s --connect-timeout 5 https://github.com > /dev/null; then
        pass "GitHub accessible"
    else
        fail "Cannot reach GitHub" "Check firewall/proxy settings"
    fi
else
    info "GitHub connectivity check skipped (curl not installed)"
fi

# Test npm registry
if command -v curl &> /dev/null; then
    if curl -s --connect-timeout 5 https://registry.npmjs.org > /dev/null; then
        pass "npm registry accessible"
    else
        warn "Cannot reach npm registry" "May need to configure proxy or mirror"
    fi
else
    info "npm registry check skipped (curl not installed)"
fi

echo ""

# ============================================
# TEST 4: Git Configuration
# ============================================

echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}📝 TEST 4: Git Configuration${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if command -v git &> /dev/null; then
    # Check git user.name
    GIT_NAME=$(git config --global user.name 2>/dev/null || echo "")
    if [[ -n "$GIT_NAME" ]]; then
        pass "Git user.name configured: $GIT_NAME"
    else
        warn "Git user.name not set" "Will be configured during deployment"
    fi

    # Check git user.email
    GIT_EMAIL=$(git config --global user.email 2>/dev/null || echo "")
    if [[ -n "$GIT_EMAIL" ]]; then
        pass "Git user.email configured: $GIT_EMAIL"
    else
        warn "Git user.email not set" "Will be configured during deployment"
    fi
else
    info "Git configuration check skipped (git not installed)"
fi

echo ""

# ============================================
# TEST 5: Package Manager
# ============================================

echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}📦 TEST 5: Package Manager${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if package manager is locked
if [[ -f "$PREFIX/var/lib/dpkg/lock" ]]; then
    if lsof "$PREFIX/var/lib/dpkg/lock" &> /dev/null; then
        warn "Package manager is currently locked" "Wait for other installations to complete"
    else
        pass "Package manager not locked"
    fi
else
    pass "Package manager not locked"
fi

# Check for broken packages
if command -v dpkg &> /dev/null; then
    BROKEN=$(dpkg --audit 2>/dev/null | wc -l)
    if [[ $BROKEN -eq 0 ]]; then
        pass "No broken packages"
    else
        warn "Found $BROKEN broken packages" "Run: dpkg --configure -a"
    fi
else
    info "Package integrity check skipped"
fi

echo ""

# ============================================
# TEST 6: Script File Check
# ============================================

echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}📄 TEST 6: Deployment Script${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

SCRIPT_NAME="termux-deploy.sh"

# Check if script exists
if [[ -f "$SCRIPT_NAME" ]]; then
    pass "Deployment script found: $SCRIPT_NAME"

    # Check if executable
    if [[ -x "$SCRIPT_NAME" ]]; then
        pass "Script is executable"
    else
        fail "Script not executable" "Run: chmod +x $SCRIPT_NAME"
    fi

    # Check shebang
    SHEBANG=$(head -1 "$SCRIPT_NAME")
    if [[ "$SHEBANG" == "#!/data/data/com.termux/files/usr/bin/bash" ]] || [[ "$SHEBANG" == "#!/bin/bash" ]]; then
        pass "Script has valid shebang"
    else
        warn "Unusual shebang: $SHEBANG" "Should work but may cause issues"
    fi

    # Check syntax
    if bash -n "$SCRIPT_NAME" 2>/dev/null; then
        pass "Script syntax valid"
    else
        fail "Script has syntax errors" "Check the script file for errors"
    fi
else
    fail "Deployment script not found: $SCRIPT_NAME" "Download from repository or check current directory"
fi

echo ""

# ============================================
# TEST 7: Security Check
# ============================================

echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}🔒 TEST 7: Security${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check for existing .env files with secrets
if [[ -f ".env" ]] || [[ -f "~/.env" ]]; then
    warn "Found existing .env file" "Ensure it doesn't contain production secrets"
else
    pass "No existing .env files found"
fi

# Check home directory permissions
HOME_PERMS=$(stat -c %a ~ 2>/dev/null || stat -f %Lp ~ 2>/dev/null || echo "750")
if [[ $HOME_PERMS == "700" ]] || [[ $HOME_PERMS == "750" ]]; then
    pass "Home directory has secure permissions"
else
    warn "Home directory permissions: $HOME_PERMS" "Consider: chmod 700 ~"
fi

# Check if running as root (not recommended)
if [[ $EUID -eq 0 ]]; then
    warn "Running as root" "Not recommended for security reasons"
else
    pass "Not running as root"
fi

echo ""

# ============================================
# TEST 8: Performance Check
# ============================================

echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}⚡ TEST 8: Performance${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test write speed
WRITE_TEST_FILE="/tmp/write_test_$$"
START_TIME=$(date +%s%N)
dd if=/dev/zero of=$WRITE_TEST_FILE bs=1M count=10 &>/dev/null
END_TIME=$(date +%s%N)
rm -f $WRITE_TEST_FILE
DURATION=$(( (END_TIME - START_TIME) / 1000000 ))
if [[ $DURATION -lt 2000 ]]; then
    pass "Write speed: ${DURATION}ms for 10MB (Good)"
elif [[ $DURATION -lt 5000 ]]; then
    warn "Write speed: ${DURATION}ms for 10MB (Acceptable)" "Deployment may be slower"
else
    warn "Write speed: ${DURATION}ms for 10MB (Slow)" "Consider using faster storage"
fi

# Check CPU info
if [[ -f /proc/cpuinfo ]]; then
    CPU_COUNT=$(grep -c processor /proc/cpuinfo)
    pass "CPU cores available: $CPU_COUNT"
else
    info "CPU check skipped"
fi

echo ""

# ============================================
# TEST 9: Optional Enhancements
# ============================================

echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}✨ TEST 9: Optional Enhancements${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check for SSH keys
if [[ -f ~/.ssh/id_rsa ]] || [[ -f ~/.ssh/id_ed25519 ]]; then
    pass "SSH keys present"
else
    info "No SSH keys found (not required, HTTP works fine)"
fi

# Check for termux-api
if command -v termux-battery-status &> /dev/null; then
    pass "Termux:API installed"
else
    info "Termux:API not installed (optional, for notifications)"
fi

# Check for termux-services
if [[ -d "$PREFIX/var/service" ]]; then
    pass "Termux services available"
else
    info "Termux services not set up (optional)"
fi

echo ""

# ============================================
# SUMMARY
# ============================================

echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}📊 TEST SUMMARY${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "  ${G}✅ Passed:${NC}   $PASSED"
echo -e "  ${R}❌ Failed:${NC}   $FAILED"
echo -e "  ${Y}⚠️  Warnings:${NC} $WARNINGS"
echo ""

# Determine readiness
if [[ $FAILED -eq 0 ]]; then
    echo -e "${G}╔════════════════════════════════════════╗${NC}"
    echo -e "${G}║  ✅ READY FOR DEPLOYMENT! ✅         ║${NC}"
    echo -e "${G}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "Your environment is ready!"
    echo ""
    echo "Next steps:"
    echo "  1. Have your API keys ready:"
    echo "     - Stripe (live or test)"
    echo "     - Google Gemini (optional)"
    echo "  2. Create GitHub/Railway accounts if needed"
    echo "  3. Run: ./termux-deploy.sh"
    echo ""

    if [[ $WARNINGS -gt 0 ]]; then
        echo -e "${Y}Note: You have $WARNINGS warnings. Review them above.${NC}"
        echo "Most warnings won't prevent deployment."
        echo ""
    fi

    exit 0
else
    echo -e "${R}╔════════════════════════════════════════╗${NC}"
    echo -e "${R}║  ❌ NOT READY FOR DEPLOYMENT ❌      ║${NC}"
    echo -e "${R}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "You have $FAILED critical issue(s) to fix."
    echo ""
    echo "Review the failed tests above and follow"
    echo "the suggested fixes."
    echo ""
    echo "Common fixes:"
    echo "  • Update packages: pkg update && pkg upgrade"
    echo "  • Install missing: pkg install nodejs git openssl"
    echo "  • Free up space: pkg clean"
    echo "  • Fix network: Check WiFi/mobile data"
    echo ""
    echo "Run this test again after fixing issues:"
    echo "  ./test-deployment.sh"
    echo ""
    exit 1
fi
