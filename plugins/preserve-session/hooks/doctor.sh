#!/usr/bin/env bash
# preserve-session: doctor
# Diagnoses the preserve-session state for the current project.

set -euo pipefail

REGISTRY="$HOME/.claude/project-registry.json"
REAL_PWD=$(realpath "$PWD" 2>/dev/null || echo "$PWD")
HASH_FILE="$REAL_PWD/.claude/hash.txt"

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# Normalize to NFC to match registry storage format (see common.sh nfc_normalize)
REAL_PWD=$(nfc_normalize "$REAL_PWD")

OK="✓"
FAIL="✗"

echo "preserve-session doctor"
echo "======================="

# 1. hash.txt
if [[ -f "$HASH_FILE" ]]; then
  HASH=$(cat "$HASH_FILE")
  echo "$OK  hash.txt       $HASH"
else
  echo "$FAIL  hash.txt       Missing — run 'claude' once to initialize"
  exit 0
fi

# 2. Registry entry
if [[ ! -f "$REGISTRY" ]]; then
  echo "$FAIL  registry       File not found at $REGISTRY"
  exit 1
fi

REGISTERED=$(PRESERVE_REGISTRY="$REGISTRY" PRESERVE_HASH="$HASH" "$PYTHON" - <<'PYEOF'
import json, os
try:
    with open(os.environ["PRESERVE_REGISTRY"]) as f:
        r = json.load(f)
except (json.JSONDecodeError, ValueError):
    r = {}
print(r.get(os.environ["PRESERVE_HASH"], ""))
PYEOF
)

if [[ -z "$REGISTERED" ]]; then
  echo "$FAIL  registry       Hash not registered — run 'claude' or /preserve-session:fix"
  exit 0
else
  echo "$OK  registry       registered"
fi

# 3. Path match
if [[ "$REGISTERED" == "$REAL_PWD" ]]; then
  echo "$OK  path match     $REAL_PWD"
else
  echo "$FAIL  path match     registered: $REGISTERED"
  echo "                   current:    $REAL_PWD"
  echo "                   → run /preserve-session:fix"
fi

# 4. Sessions folder
SLUG=$(path_to_slug "$REAL_PWD")
SESSIONS_DIR="$HOME/.claude/projects/$SLUG"

if [[ -d "$SESSIONS_DIR" ]]; then
  SESSION_COUNT=$(find "$SESSIONS_DIR" -maxdepth 1 -name "*.jsonl" | wc -l | tr -d ' ')
  echo "$OK  sessions       $SESSION_COUNT session(s) found in $SESSIONS_DIR"
else
  echo "$OK  sessions       No sessions yet (will be created on first claude run)"
fi

# 5. SessionStart hook (checks settings.json only)
# Note: hooks registered via --plugin-dir or claude plugin install are not reflected
# in settings.json and cannot be detected here. If you installed the plugin, the hook
# is active even if this check shows ✗.
HOOK_FOUND=false
for settings in "$REAL_PWD/.claude/settings.json" "$HOME/.claude/settings.json"; do
  if [[ -f "$settings" ]]; then
    if PRESERVE_SETTINGS="$settings" "$PYTHON" - <<'PYEOF' 2>/dev/null
import json, os, sys
with open(os.environ["PRESERVE_SETTINGS"]) as f:
    s = json.load(f)
hooks = s.get("hooks", {}).get("SessionStart", [])
found = any("preserve-session" in str(h) or "session-start" in str(h) for h in hooks)
sys.exit(0 if found else 1)
PYEOF
    then
      HOOK_FOUND=true
      break
    fi
  fi
done

if $HOOK_FOUND; then
  echo "$OK  hook           SessionStart hook registered in settings.json"
else
  echo "~  hook           not found in settings.json"
  echo "                   (if plugin is installed/loaded, hook is still active)"
fi

# 6. Path encoding + slug collision
if "$PYTHON" -c "import sys; sys.exit(0 if all(ord(c) < 128 for c in sys.argv[1]) else 1)" "$REAL_PWD" 2>/dev/null; then
  echo "$OK  path encoding  ASCII only"
else
  echo "~  path encoding  non-ASCII characters detected"
  echo "                   path: $REAL_PWD"
fi

SLUG_COLLISION=$(check_slug_collision "$REAL_PWD")
if [[ -n "$SLUG_COLLISION" ]]; then
  echo "$FAIL  slug collision  matches other registered project(s):"
  while IFS= read -r line; do
    echo "                   $line"
  done <<< "$SLUG_COLLISION"
  echo "                   → /preserve-session:fix and /preserve-session:inherit will be blocked"
else
  echo "$OK  slug collision none"
fi

# 7. Registry health
echo ""
echo "Registry health"
echo "==============="

PRESERVE_REAL_PWD="$REAL_PWD" "$PYTHON" - <<'PYEOF'
import json, os, sys

registry_path = os.path.expanduser("~/.claude/project-registry.json")
try:
    with open(registry_path) as f:
        registry = json.load(f)
except (json.JSONDecodeError, ValueError):
    print("  (registry file is corrupted — cannot display health)")
    sys.exit(0)

ok      = "\u2713"
fail    = "\u2717"
current = os.environ["PRESERVE_REAL_PWD"]

for hash_val, path in sorted(registry.items(), key=lambda x: x[1]):
    label = "  (current)" if path == current else ""
    if os.path.isdir(path):
        print(f"  {ok}  {path}{label}")
    else:
        print(f"  {fail}  {path}  \033[2m(path not found — stale)\033[0m")
PYEOF
