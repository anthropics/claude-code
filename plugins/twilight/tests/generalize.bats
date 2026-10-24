#!/usr/bin/env bats
# Unit 8 — public generalization (twilight:8.1.1–8.1.6)

PLUGIN_ROOT="$BATS_TEST_DIRNAME/.."
CLI="$PLUGIN_ROOT/hooks/twilight-focus.sh"
SS="$PLUGIN_ROOT/hooks/session-start.sh"

# 8.1.1
@test "gate and push accept checkbox-first plan form (- [ ] <id>)" {
  PROJ="$BATS_TEST_TMPDIR/proj" && mkdir -p "$PROJ/agents" && cd "$PROJ"
  cat > agents/alt-plan.md <<'EOF'
- [x] 1.1.1 finished item
- [ ] 1.2.1 open item
EOF
  run "$CLI" push alt:1.2.1
  [ "$status" -eq 0 ]
  run "$CLI" gate alt:1.1.1
  [ "$status" -eq 0 ]
  run "$CLI" gate alt:1.2.1
  [ "$status" -eq 1 ]
  [[ "$output" == *"1.2.1"* ]]
}

# 8.1.2
@test "INDEX rows parse regardless of table cosmetics" {
  PROJ="$BATS_TEST_TMPDIR/proj2" && mkdir -p "$PROJ/agents" "$PROJ/specs" && cd "$PROJ"
  printf -- '- 1.1.1 [ ] task\n' > agents/demo-plan.md
  cat > specs/INDEX.md <<'EOF'
Some prose, no table header.
* demo-plan is active
EOF
  run "$CLI" plans
  [ "$status" -eq 0 ]
  [ "$output" = "demo" ]
  run "$CLI" next demo
  [[ "$output" == *"1.1.1"* ]]
}

# 8.1.3
@test ".twilight config overrides directories; defaults hold without it" {
  PROJ="$BATS_TEST_TMPDIR/proj3" && mkdir -p "$PROJ" && cd "$PROJ"
  printf 'SPECS_DIR=work/specs\nPLANS_DIR=work/plans\n' > .twilight
  mkdir -p work/plans work/specs
  printf -- '- 1.1.1 [ ] task\n' > work/plans/cfg-plan.md
  printf '| [cfg-spec](x) | [cfg-plan](y) | active |\n' > work/specs/INDEX.md
  run "$CLI" push cfg:1.1.1
  [ "$status" -eq 0 ]
  [ -f work/plans/state/focus.md ]
  run "$CLI" plans
  [ "$output" = "cfg" ]
}

# 8.1.4
@test "single stack by default; MULTI_CLONE=1 keys by clone-id" {
  PROJ="$BATS_TEST_TMPDIR/proj4" && mkdir -p "$PROJ/agents" && cd "$PROJ"
  printf -- '- 1.1.1 [ ] task\n' > agents/demo-plan.md
  "$CLI" push demo:1.1.1
  [ -f agents/state/focus.md ]
  printf 'MULTI_CLONE=1\n' > .twilight
  "$CLI" push '[explore: keyed]'
  CID=$("$CLI" clone-id)
  [ -f "agents/state/$CID/focus.md" ]
}

# 8.1.5
@test "skills carry no prose/commit rules or personal examples; memory renamed; CLAUDE.md approval-gated" {
  ! grep -rqi 'cajeta\|proton\|julian' "$PLUGIN_ROOT/skills/"
  ! grep -qi 'prose style' "$PLUGIN_ROOT/skills/design/SKILL.md"
  ! grep -qi 'commit message' "$PLUGIN_ROOT/skills/implement/SKILL.md"
  [ -f "$PLUGIN_ROOT/skills/design/twilight-workflow.md" ]
  [ ! -f "$PLUGIN_ROOT/skills/design/td-project-workflow.md" ]
  grep -qi 'approval' "$PLUGIN_ROOT/skills/design/SKILL.md"
  grep -q 'CLAUDE.md' "$PLUGIN_ROOT/skills/design/SKILL.md"
}

# 8.1.6
@test "README documents format contracts and .twilight config" {
  grep -qi 'format contract' "$PLUGIN_ROOT/README.md"
  grep -q '.twilight' "$PLUGIN_ROOT/README.md"
  grep -q 'MULTI_CLONE' "$PLUGIN_ROOT/README.md"
}
