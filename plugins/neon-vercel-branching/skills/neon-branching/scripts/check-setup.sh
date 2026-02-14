#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# check-setup.sh — Validate Neon + Vercel branching configuration
#
# Checks:
#   1. Required environment variables
#   2. GitHub secrets/variables
#   3. Workflow files exist
#   4. Neon API connectivity
#   5. Vercel CLI availability
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass=0
warn=0
fail=0

check_pass()  { echo -e "  ${GREEN}✓${NC} $1"; ((pass++)); }
check_warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; ((warn++)); }
check_fail()  { echo -e "  ${RED}✗${NC} $1"; ((fail++)); }

echo "Neon + Vercel Branching Setup Check"
echo "──────────────────────────────────────"

# ── 1. Environment variables ──
echo ""
echo "Environment:"
if [ -n "${NEON_API_KEY:-}" ]; then
  check_pass "NEON_API_KEY is set"
else
  check_fail "NEON_API_KEY is not set (export NEON_API_KEY=...)"
fi

if [ -n "${NEON_PROJECT_ID:-}" ]; then
  check_pass "NEON_PROJECT_ID is set ($NEON_PROJECT_ID)"
else
  check_warn "NEON_PROJECT_ID is not set (needed for local usage)"
fi

if [ -n "${VERCEL_TOKEN:-}" ]; then
  check_pass "VERCEL_TOKEN is set"
else
  check_warn "VERCEL_TOKEN is not set (needed for CLI deploys)"
fi

# ── 2. GitHub secrets ──
echo ""
echo "GitHub Secrets:"
if command -v gh &>/dev/null; then
  for secret in NEON_API_KEY VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID; do
    if gh secret list 2>/dev/null | grep -q "$secret"; then
      check_pass "$secret configured in GitHub"
    else
      check_warn "$secret not found in GitHub secrets"
    fi
  done

  # Check variables
  if gh variable list 2>/dev/null | grep -q "NEON_PROJECT_ID"; then
    check_pass "NEON_PROJECT_ID configured as GitHub variable"
  else
    check_warn "NEON_PROJECT_ID not found in GitHub variables"
  fi
else
  check_warn "gh CLI not available — skipping GitHub checks"
fi

# ── 3. Workflow files ──
echo ""
echo "Workflow Files:"
root=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
for wf in neon-vercel-preview.yml neon-vercel-cleanup.yml neon-vercel-production.yml; do
  if [ -f "$root/.github/workflows/$wf" ]; then
    check_pass "$wf exists"
  else
    check_fail "$wf missing from .github/workflows/"
  fi
done

# ── 4. Neon API connectivity ──
echo ""
echo "Neon API:"
if [ -n "${NEON_API_KEY:-}" ]; then
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $NEON_API_KEY" \
    "https://console.neon.tech/api/v2/projects" 2>/dev/null || echo "000")
  if [ "$status" = "200" ]; then
    check_pass "Neon API reachable (HTTP $status)"
  elif [ "$status" = "401" ]; then
    check_fail "Neon API key invalid (HTTP 401)"
  else
    check_warn "Neon API returned HTTP $status"
  fi
else
  check_warn "Skipping Neon API check (no API key)"
fi

# ── 5. Vercel CLI ──
echo ""
echo "Vercel CLI:"
if command -v vercel &>/dev/null; then
  ver=$(vercel --version 2>/dev/null || echo "unknown")
  check_pass "Vercel CLI installed ($ver)"
else
  check_warn "Vercel CLI not installed (npm i -g vercel)"
fi

# ── Summary ──
echo ""
echo "──────────────────────────────────────"
echo -e "  ${GREEN}$pass passed${NC}  ${YELLOW}$warn warnings${NC}  ${RED}$fail failed${NC}"

if [ $fail -gt 0 ]; then
  echo ""
  echo "Fix the failures above before using the branching workflows."
  exit 1
fi
