#!/usr/bin/env bats
# Unit 4 — UserPromptSubmit hook (twilight:4.1.1–4.1.3)

HOOK="$BATS_TEST_DIRNAME/../hooks/prompt-submit.sh"
CLI="$BATS_TEST_DIRNAME/../hooks/twilight-focus.sh"

make_project() {
  PROJ="$BATS_TEST_TMPDIR/proj"
  mkdir -p "$PROJ/agents" "$PROJ/specs"
  cat > "$PROJ/specs/INDEX.md" <<'EOF'
| Spec | Plan | Status |
|------|------|--------|
| [demo-spec](./demo-spec.md) | [demo-plan](../agents/demo-plan.md) | active |
EOF
  printf -- '- 1.2.1 [ ] next open item\n' > "$PROJ/agents/demo-plan.md"
  cd "$PROJ"
}

# 4.1.1
@test "non-empty stack: context names top-of-stack" {
  make_project
  "$CLI" push demo:1.2.1
  "$CLI" push '[explore: tangent]'
  run bash -c "jq -n --arg cwd '$PROJ' '{cwd: \$cwd, prompt: \"hi\"}' | '$HOOK'"
  [ "$status" -eq 0 ]
  ctx=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
  [[ "$ctx" == *"[explore: tangent]"* ]]
}

# 4.1.2
@test "empty stack with active plan: follow-plan message with next id" {
  make_project
  run bash -c "jq -n --arg cwd '$PROJ' '{cwd: \$cwd, prompt: \"hi\"}' | '$HOOK'"
  [ "$status" -eq 0 ]
  ctx=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
  [[ "$ctx" == *"follow plan demo"* ]]
  [[ "$ctx" == *"1.2.1"* ]]
}

# 4.1.3
@test "no twilight structure: exit 0, no output" {
  BARE="$BATS_TEST_TMPDIR/bare" && mkdir -p "$BARE" && cd "$BARE"
  run bash -c "jq -n --arg cwd '$BARE' '{cwd: \$cwd, prompt: \"hi\"}' | '$HOOK'"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}
