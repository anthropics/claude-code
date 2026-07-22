#!/usr/bin/env bats
# Unit 2 — focus-stack CLI core (twilight:2.1.1–2.1.7, 2.2.2)

CLI="$BATS_TEST_DIRNAME/../hooks/twilight-focus.sh"

setup() {
  PROJ="$BATS_TEST_TMPDIR/proj"
  mkdir -p "$PROJ/agents"
  cat > "$PROJ/agents/demo-plan.md" <<'EOF'
# demo — plan
## 1. Unit
- 1.1.1 [ ] open item
- 1.2.1 [x] done item
EOF
  cd "$PROJ"
  CID="$(hostname)-$(pwd | sed 's|^/||; s|/|-|g')"
  STATE="agents/state/$CID"
}

# 2.1.1
@test "clone-id derives hostname plus slugified absolute path" {
  run "$CLI" clone-id
  [ "$status" -eq 0 ]
  [ "$output" = "$CID" ]
}

# 2.1.2
@test "push prepends entry with date, creating state dirs on first write" {
  run "$CLI" push demo:1.1.1
  [ "$status" -eq 0 ]
  [ -f "$STATE/focus.md" ]
  [ "$(head -1 "$STATE/focus.md")" = "demo:1.1.1  $(date +%F)" ]
  "$CLI" push '[explore: buffer sizing]'
  [ "$(head -1 "$STATE/focus.md")" = "[explore: buffer sizing]  $(date +%F)" ]
  [ "$(wc -l < "$STATE/focus.md")" -eq 2 ]
}

# 2.1.3
@test "pop removes only the top line and prints the popped entry" {
  "$CLI" push demo:1.1.1
  "$CLI" push '[explore: tangent]'
  run "$CLI" pop
  [ "$status" -eq 0 ]
  [ "$output" = "[explore: tangent]" ]
  [ "$(wc -l < "$STATE/focus.md")" -eq 1 ]
  [ "$(head -1 "$STATE/focus.md")" = "demo:1.1.1  $(date +%F)" ]
  "$CLI" pop
  run "$CLI" pop   # empty → no-op
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

# 2.1.4
@test "show renders top-first with dates; empty stack shows empty" {
  run "$CLI" show
  [ "$status" -eq 0 ]
  [ "$output" = "empty" ]
  "$CLI" push demo:1.1.1
  "$CLI" push '[explore: x]'
  run "$CLI" show
  [ "${lines[0]}" = "[explore: x]  $(date +%F)" ]
  [ "${lines[1]}" = "demo:1.1.1  $(date +%F)" ]
}

# 2.1.5
@test "reset archives a timestamped snapshot then clears; archives accumulate" {
  "$CLI" push demo:1.1.1
  "$CLI" reset
  [ ! -s "$STATE/focus.md" ]
  grep -q "demo:1.1.1" "$STATE/focus-archive.md"
  grep -cq "^## reset " "$STATE/focus-archive.md"
  "$CLI" push demo:1.2.1
  "$CLI" reset
  [ "$(grep -c '^## reset ' "$STATE/focus-archive.md")" -eq 2 ]
  grep -q "demo:1.2.1" "$STATE/focus-archive.md"
}

# 2.1.6
@test "lock acquire/check/release reports foreign owner" {
  run "$CLI" lock acquire sessA
  [ "$status" -eq 0 ]
  run "$CLI" lock check sessA
  [ "$status" -eq 0 ]
  [ "$output" = "ok" ]
  run "$CLI" lock check sessB
  [ "$status" -eq 0 ]
  [[ "$output" == *"sessA"* ]]
  "$CLI" lock release sessA
  run "$CLI" lock check sessB
  [ "$output" = "ok" ]
}

# 2.1.7
@test "read subcommands degrade outside a twilight project" {
  BARE="$BATS_TEST_TMPDIR/bare" && mkdir -p "$BARE" && cd "$BARE"
  for cmd in show pop reset; do
    run "$CLI" "$cmd"
    [ "$status" -eq 0 ]
  done
  run "$CLI" show
  [ "$output" = "empty" ]
}

# 2.2.2
@test "push validates entries: plan ids must exist, else explore form required" {
  run "$CLI" push demo:9.9.9        # id not in plan
  [ "$status" -eq 1 ]
  run "$CLI" push missing:1.1.1     # no such plan
  [ "$status" -eq 1 ]
  run "$CLI" push "random prose"    # neither form
  [ "$status" -eq 1 ]
  run "$CLI" push demo              # whole plan document — valid (spec 3.1.4)
  [ "$status" -eq 0 ]
  [ "$(head -1 "$STATE/focus.md")" = "demo  $(date +%F)" ]
}
