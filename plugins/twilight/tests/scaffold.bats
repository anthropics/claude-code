#!/usr/bin/env bats
# Unit 1 — plugin scaffold (twilight:1.1.1, 1.1.2, 1.3.1)

PLUGIN_ROOT="$BATS_TEST_DIRNAME/.."

# 1.1.1
@test "plugin.json valid with name twilight, version, description" {
  [ -f "$PLUGIN_ROOT/.claude-plugin/plugin.json" ]
  jq -e '.name == "twilight" and (.version | length > 0) and (.description | length > 0)' \
    "$PLUGIN_ROOT/.claude-plugin/plugin.json"
}

# 1.1.2
@test "hooks.json declares SessionStart and UserPromptSubmit with CLAUDE_PLUGIN_ROOT commands" {
  local f="$PLUGIN_ROOT/hooks/hooks.json"
  [ -f "$f" ]
  jq -e '.hooks | has("SessionStart") and has("UserPromptSubmit")' "$f"
  for event in SessionStart UserPromptSubmit; do
    jq -e --arg e "$event" '.hooks[$e][0].hooks[0].command | contains("${CLAUDE_PLUGIN_ROOT}")' "$f"
  done
}

# 1.3.1
@test "script stubs are executable and exit 0 on empty JSON input" {
  for s in twilight-focus.sh session-start.sh prompt-submit.sh; do
    [ -x "$PLUGIN_ROOT/hooks/$s" ]
    echo '{}' | "$PLUGIN_ROOT/hooks/$s"
  done
}
