#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLLECTOR="$SCRIPT_DIR/list-slash-commands.sh"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local message="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    fail "$message (missing: $needle)"
  fi
}

assert_not_contains() {
  local haystack="$1"
  local needle="$2"
  local message="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    fail "$message (unexpected: $needle)"
  fi
}

line_number_of() {
  local haystack="$1"
  local needle="$2"
  printf '%s\n' "$haystack" | grep -nF "$needle" | head -n 1 | cut -d: -f1
}

TMP_ROOT="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

test_no_results() {
  local ws="$TMP_ROOT/no-results"
  local output
  mkdir -p "$ws"
  output="$("$COLLECTOR" --workspace "$ws")"

  assert_contains "$output" "Detected slash commands in current workspace:" "header should be present"
  assert_contains "$output" "Project" "project section should be present"
  assert_contains "$output" "Plugins" "plugins section should be present"
  assert_contains "$output" "  (none detected)" "empty workspace should show no detections"
  assert_not_contains "$output" "Some command sources could not be introspected" "missing dirs should not produce source warning"
}

test_project_detection_and_sorting() {
  local ws="$TMP_ROOT/project"
  local output
  local alpha_line zeta_line nested_line

  mkdir -p "$ws/.claude/commands/nested"
  cat > "$ws/.claude/commands/zeta.md" <<'EOF'
---
description: Zeta command
---
zeta body
EOF
  cat > "$ws/.claude/commands/alpha.md" <<'EOF'
---
description: Alpha command
argument-hint: [issue-number]
---
alpha body
EOF
  cat > "$ws/.claude/commands/nested/build.md" <<'EOF'
---
description: Build nested command
---
nested body
EOF

  output="$("$COLLECTOR" --workspace "$ws")"

  assert_contains "$output" "  /alpha" "project command /alpha should be listed"
  assert_contains "$output" "description: Alpha command" "description should be extracted"
  assert_contains "$output" "usage: [issue-number]" "argument-hint should appear as usage"
  assert_contains "$output" "origin: .claude/commands/alpha.md" "project origin should be relative"
  assert_contains "$output" "  /zeta" "project command /zeta should be listed"
  assert_contains "$output" "usage: -" "missing argument-hint should render as '-'"
  assert_contains "$output" "origin: .claude/commands/zeta.md" "origin should still render when usage is missing"
  assert_contains "$output" "  /nested:build" "nested project command should be namespaced"

  alpha_line="$(line_number_of "$output" "  /alpha")"
  nested_line="$(line_number_of "$output" "  /nested:build")"
  zeta_line="$(line_number_of "$output" "  /zeta")"
  if [[ -z "$alpha_line" || -z "$nested_line" || -z "$zeta_line" ]]; then
    fail "expected line numbers for project sort assertions"
  fi
  if (( alpha_line >= nested_line || nested_line >= zeta_line )); then
    fail "project commands should be sorted by name"
  fi
}

test_plugin_detection() {
  local ws="$TMP_ROOT/plugins"
  local output

  mkdir -p "$ws/plugins/acme/commands/review"
  mkdir -p "$ws/plugins/acme/.claude-plugin"
  mkdir -p "$ws/plugins/fallback/commands"

  cat > "$ws/plugins/acme/.claude-plugin/plugin.json" <<'EOF'
{
  "name": "acme-tools"
}
EOF
  cat > "$ws/plugins/acme/commands/review/security.md" <<'EOF'
---
description: Security review command
argument-hint: [pr]
---
review body
EOF
  cat > "$ws/plugins/fallback/commands/lint.md" <<'EOF'
---
description: Lint command
---
lint body
EOF

  output="$("$COLLECTOR" --workspace "$ws")"

  assert_contains "$output" "  /review:security" "nested plugin command should be namespaced"
  assert_contains "$output" "source: plugin:acme-tools" "plugin source should use manifest name"
  assert_contains "$output" "origin: plugins/acme/commands/review/security.md" "plugin origin should be relative"
  assert_contains "$output" "  /lint" "fallback plugin command should be listed"
  assert_contains "$output" "source: plugin:fallback" "plugin source should fallback to dir name"
}

test_unavailable_sources_do_not_crash() {
  local ws="$TMP_ROOT/unavailable"
  local output status

  mkdir -p "$ws"
  printf 'not-a-directory' > "$ws/.claude"
  printf 'not-a-directory' > "$ws/plugins"

  set +e
  output="$("$COLLECTOR" --workspace "$ws")"
  status=$?
  set -e

  if [[ "$status" -ne 0 ]]; then
    fail "collector should not fail when command sources are unavailable"
  fi
  assert_contains "$output" "Note: Some command sources could not be introspected." "unavailable sources should produce warning"
}

test_no_results
test_project_detection_and_sorting
test_plugin_detection
test_unavailable_sources_do_not_crash

echo "PASS: list-slash-commands collector tests"
