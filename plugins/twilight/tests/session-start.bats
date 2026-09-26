#!/usr/bin/env bats
# Unit 3 — SessionStart hook (twilight:3.1.1, 3.1.2)

HOOK="$BATS_TEST_DIRNAME/../hooks/session-start.sh"
CLI="$BATS_TEST_DIRNAME/../hooks/twilight-focus.sh"

make_project() {
  PROJ="$BATS_TEST_TMPDIR/proj"
  mkdir -p "$PROJ/agents" "$PROJ/specs"
  cat > "$PROJ/specs/INDEX.md" <<'EOF'
# Active work index

| Spec | Plan | Status |
|------|------|--------|
| [demo-spec](./demo-spec.md) | [demo-plan](../agents/demo-plan.md) | active |
EOF
  cat > "$PROJ/agents/demo-plan.md" <<'EOF'
# demo — plan
- 1.1.1 [x] done item
- 1.2.1 [ ] next open item
- 1.3.1 [ ] later item
EOF
  cd "$PROJ"
}

# 3.1.1
@test "injects stack with dates, next plan item, and lock status" {
  make_project
  "$CLI" push demo:1.2.1
  run bash -c "jq -n --arg cwd '$PROJ' '{session_id: \"sess1\", cwd: \$cwd}' | '$HOOK'"
  [ "$status" -eq 0 ]
  ctx=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
  [ "$(echo "$output" | jq -r '.hookSpecificOutput.hookEventName')" = "SessionStart" ]
  [[ "$ctx" == *"demo:1.2.1  $(date +%F)"* ]]
  [[ "$ctx" == *"1.2.1"* ]]
  [[ "$ctx" == *"demo"* ]]
  [[ "$ctx" == *"lock"* ]]
}

# 3.1.1 lock conflict surfaces
@test "reports foreign lock owner in context" {
  make_project
  "$CLI" lock acquire other-session
  run bash -c "jq -n --arg cwd '$PROJ' '{session_id: \"sess2\", cwd: \$cwd}' | '$HOOK'"
  [ "$status" -eq 0 ]
  ctx=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
  [[ "$ctx" == *"locked by other-session"* ]]
}

# 3.1.2
@test "no twilight structure: exit 0, no output" {
  BARE="$BATS_TEST_TMPDIR/bare" && mkdir -p "$BARE" && cd "$BARE"
  run bash -c "jq -n --arg cwd '$BARE' '{session_id: \"sess1\", cwd: \$cwd}' | '$HOOK'"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}
