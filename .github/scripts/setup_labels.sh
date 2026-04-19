#!/usr/bin/env bash
# =============================================================================
# Ethos Aegis — GitHub Label Setup Script
# =============================================================================
# Creates all branded GitHub labels for the Ethos Aegis repository.
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated: gh auth login
#   - Run from anywhere; REPO defaults to current directory's remote origin
#
# Usage:
#   bash .github/scripts/setup_labels.sh
#   REPO="owner/repo" bash .github/scripts/setup_labels.sh
#
# The script is idempotent: existing labels are updated, new ones created.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Allow override via environment variable
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")}"

if [[ -z "$REPO" ]]; then
  echo "ERROR: Could not determine repository. Set REPO=owner/repo or run from inside the repository." >&2
  exit 1
fi

echo "🛡️  Ethos Aegis Label Setup"
echo "   Repository: $REPO"
echo ""

# ---------------------------------------------------------------------------
# Fetch existing labels once and cache in a variable
# ---------------------------------------------------------------------------
echo "Fetching existing labels…"
EXISTING_LABELS="$(gh label list --repo "$REPO" --limit 300 --json name -q '.[].name' 2>/dev/null || echo "")"

# ---------------------------------------------------------------------------
# Helper — create or update a label
# ---------------------------------------------------------------------------
# Usage: label "name" "hex-color" "description"
# Color must be a 6-character hex without the '#' prefix (GitHub API format).
label() {
  local name="$1"
  local color="$2"
  local description="$3"

  # Strip leading '#' if present
  color="${color#\#}"

  if echo "$EXISTING_LABELS" | grep -qxF "$name"; then
    gh label edit "$name" \
      --repo "$REPO" \
      --color "$color" \
      --description "$description" \
      2>/dev/null && echo "  ✎  Updated : $name" || echo "  ⚠  Skipped : $name (edit failed)"
  else
    gh label create "$name" \
      --repo "$REPO" \
      --color "$color" \
      --description "$description" \
      2>/dev/null && echo "  ✚  Created : $name" || echo "  ⚠  Skipped : $name (create failed)"
  fi
}

# =============================================================================
# 1. VERDICT LABELS
#    Represent the final immune verdict on an issue / agent action.
# =============================================================================
echo "━━━ Verdict Labels ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

label "verdict: sanctified"   "00E57A" "Clean — no threat detected; agent behavior approved"
label "verdict: trace"        "4D9FFF" "Low-signal anomaly detected; under passive monitoring"
label "verdict: quarantined"  "F5C842" "Suspended pending further review; neither condemned nor clear"
label "verdict: grave"        "FF9A3C" "High-severity threat confirmed; escalation required"
label "verdict: condemned"    "FF4F5E" "Critical threat; agent or input rejected outright"

# =============================================================================
# 2. SENTINEL CELL LABELS
#    Identify which immune sentinel cell is responsible for handling the issue.
# =============================================================================
echo ""
echo "━━━ Sentinel Cell Labels ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

label "cell: VanguardProbe"    "C9A84C" "Primary context intake and upstream signal scanning"
label "cell: TaintBeacon"      "E8C96A" "Detects tainted or poisoned input in the pipeline"
label "cell: SanitasSwarm"     "8B6E2A" "Sanitization and normalization layer"
label "cell: LogosScythe"      "9BAAB8" "Semantic and logical consistency verification"
label "cell: MnemosyneCache"   "6B7A90" "Memory retrieval integrity and replay attack detection"
label "cell: EntropicWatch"    "4D9FFF" "Entropy and randomness anomaly monitoring"
label "cell: FinalityForge"    "FF4F5E" "Terminal decision forging and verdict enforcement"
label "cell: CytokineCommand"  "C9A84C" "Orchestration signals and inter-cell communication"

# =============================================================================
# 3. THREAT CLASS LABELS (Maligna Taxonomy)
#    Classify the type of threat or adversarial pattern observed.
# =============================================================================
echo ""
echo "━━━ Threat Class Labels (Maligna) ━━━━━━━━━━━━━━━━━━━━━━"

label "threat: MoralMaligna"      "FF4F5E" "Ethical / value-alignment attack on agent behavior"
label "threat: NarcissisMaligna"  "FF9A3C" "Self-referential manipulation; agent ego inflation"
label "threat: ParasiticMaligna"  "F5C842" "Resource hijacking or dependency chain poisoning"
label "threat: SymbolicMaligna"   "4D9FFF" "Symbolic manipulation; prompt injection via language"
label "threat: NaturalMaligna"    "6B7A90" "Naturally-occurring drift or benign degradation"
label "threat: MetaMaligna"       "9BAAB8" "Meta-level attacks on the verification system itself"
label "threat: SystemicMaligna"   "C9A84C" "Infrastructure-level or systemic compromise"

# =============================================================================
# 4. PROCESS / WORKFLOW LABELS
#    Standard issue and PR workflow management labels.
# =============================================================================
echo ""
echo "━━━ Process / Workflow Labels ━━━━━━━━━━━━━━━━━━━━━━━━━━━"

label "triage"              "E8C96A" "Awaiting initial triage and classification"
label "needs-test"          "C9A84C" "Requires a test case or reproduction steps"
label "needs-repro"         "FF9A3C" "Cannot reproduce — more information needed"
label "false-positive"      "4D9FFF" "Determined to be a false positive verdict"
label "false-negative"      "FF4F5E" "Missed threat — model failed to flag"
label "enhancement"         "00E57A" "New capability or improvement proposal"
label "bug"                 "FF4F5E" "Confirmed defect in existing behavior"
label "documentation"       "6B7A90" "Documentation update or correction needed"
label "security"            "FF4F5E" "Security-relevant issue requiring expedited review"
label "performance"         "FF9A3C" "Performance regression or optimization request"
label "refactor"            "9BAAB8" "Code quality or architecture refactoring"
label "dependencies"        "8B6E2A" "Dependency update or vulnerability patch"
label "good first issue"    "00E57A" "Suitable entry point for new contributors"
label "help wanted"         "E8C96A" "Community assistance requested"
label "wontfix"             "9BAAB8" "Acknowledged but will not be addressed"
label "duplicate"           "6B7A90" "Duplicate of an existing issue or PR"
label "invalid"             "9BAAB8" "Does not meet criteria or is out of scope"
label "blocked"             "FF4F5E" "Blocked by external dependency or decision"
label "in-progress"         "4D9FFF" "Actively being worked on"
label "review-required"     "C9A84C" "Requires peer or maintainer review before merge"
label "release"             "00E57A" "Tied to a versioned release milestone"
label "breaking-change"     "FF4F5E" "Introduces a breaking API or behavior change"
label "axiom-revision"      "C9A84C" "Proposes a change to core ethical axioms or rules"
label "pipeline-integrity"  "00E57A" "Relates to the integrity of the verification pipeline"

# =============================================================================
# Done
# =============================================================================
echo ""
echo "✅ Label setup complete for $REPO"
echo "   $(gh label list --repo "$REPO" --limit 300 --json name -q 'length') labels now configured."
