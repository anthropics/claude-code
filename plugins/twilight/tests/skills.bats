#!/usr/bin/env bats
# Unit 6 — skills in the plugin (twilight:6.1.1, 6.1.2)

PLUGIN_ROOT="$BATS_TEST_DIRNAME/.."

# 6.1.1
@test "design and implement skills exist with frontmatter" {
  for s in design implement; do
    f="$PLUGIN_ROOT/skills/$s/SKILL.md"
    [ -f "$f" ]
    head -1 "$f" | grep -q '^---$'
    grep -q '^name:' "$f"
    grep -q '^description:' "$f"
  done
}

# 6.1.1 design additions
@test "design skill contains the proportionality tiers" {
  f="$PLUGIN_ROOT/skills/design/SKILL.md"
  grep -qi 'feature' "$f"
  grep -qi 'increment' "$f"
  grep -qi 'exploration' "$f"
  grep -qi 'tier' "$f"
}

# 6.1.1 implement additions
@test "implement skill contains pop gate, reset prohibition, lock protocol, file-over-memory" {
  f="$PLUGIN_ROOT/skills/implement/SKILL.md"
  grep -q 'gate' "$f"
  grep -qi 'never.*reset\|reset.*user-only\|user-only.*reset' "$f"
  grep -q 'focus.lock\|lock' "$f"
  grep -qi 'file-over-memory' "$f"
  grep -q 'twilight-focus.sh' "$f"
}

# 6.1.2
@test "bundled twilight-workflow.md present with dated entry format" {
  f="$PLUGIN_ROOT/skills/design/twilight-workflow.md"
  [ -f "$f" ]
  grep -q 'focus.md' "$f"
  grep -q 'YYYY-MM-DD' "$f"
}
