#!/usr/bin/env bats
# Unit 7 — docs and index (twilight:7.1.1)

@test "plugins/README.md indexes twilight" {
  f="$BATS_TEST_DIRNAME/../../README.md"
  grep -q '\[twilight\](./twilight/)' "$f"
}
