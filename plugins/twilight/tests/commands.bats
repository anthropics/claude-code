#!/usr/bin/env bats
# Unit 5 — /focus commands and pop gate (twilight:5.1.1, 5.1.2)

PLUGIN_ROOT="$BATS_TEST_DIRNAME/.."
CLI="$PLUGIN_ROOT/hooks/twilight-focus.sh"

# 5.1.1
@test "command files exist with frontmatter and invoke the CLI core" {
  for c in focus focus-push focus-pop focus-reset; do
    f="$PLUGIN_ROOT/commands/$c.md"
    [ -f "$f" ]
    head -1 "$f" | grep -q '^---$'
    grep -q '^description:' "$f"
    grep -q 'twilight-focus.sh' "$f"
  done
}

setup_gate_project() {
  PROJ="$BATS_TEST_TMPDIR/proj"
  mkdir -p "$PROJ/agents"
  cat > "$PROJ/agents/demo-plan.md" <<'EOF'
- 1.1.1 [x] finished item
- 1.2.1 [ ] open item
- 1.3.1 [~] blocked item
EOF
  cd "$PROJ"
}

# 5.1.2
@test "gate passes on checked plan ids, fails listing unmet, --force bypasses" {
  setup_gate_project
  run "$CLI" gate demo:1.1.1
  [ "$status" -eq 0 ]
  run "$CLI" gate demo:1.2.1
  [ "$status" -eq 1 ]
  [[ "$output" == *"1.2.1 [ ] open item"* ]]
  run "$CLI" gate demo:1.3.1
  [ "$status" -eq 1 ]
  run "$CLI" gate --force demo:1.2.1
  [ "$status" -eq 0 ]
}

# 5.1.2 whole-plan and explore entries
@test "gate on whole plan requires all items checked; explore entries always pass" {
  setup_gate_project
  run "$CLI" gate demo
  [ "$status" -eq 1 ]
  [[ "$output" == *"1.2.1"* ]]
  run "$CLI" gate '[explore: anything]'
  [ "$status" -eq 0 ]
  sed -i 's/\[ \]/[x]/; s/\[~\]/[x]/' agents/demo-plan.md
  run "$CLI" gate demo
  [ "$status" -eq 0 ]
}
