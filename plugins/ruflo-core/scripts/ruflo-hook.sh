#!/usr/bin/env bash
# ruflo-hook.sh — resilient invoker for ruflo CLI hook subcommands (#1921).
#
# Hooks fire on EVERY PreToolUse / PostToolUse / Stop. A bare
# `npx <pkg>@alpha hooks …` re-resolves the @alpha dist-tag and re-installs
# from cold cache on every fire, and when the install crashes (e.g. an
# arborist `Invalid Version` on npm 10.8.x) the user sees a hook error in
# Claude Code after every turn. This shim:
#   1. prefers an already-installed `ruflo` / `claude-flow` binary (no npx,
#      no install) — the common case for plugin users;
#   2. falls back to `npx --prefer-offline` so a populated npx cache is
#      reused instead of a fresh registry resolve;
#   3. ALWAYS exits 0 — hook subcommands are best-effort telemetry/learning;
#      a failure must never surface an error or block a turn.
#
# stdin (the hook event JSON) is passed through to the CLI unchanged.
# Usage: ruflo-hook.sh <hook-subcommand> [args…]   (the literal `hooks`
# word is prepended here, so callers pass e.g. `post-edit -f "$FILE" -s true`).

# Swallow all diagnostics — nothing this script prints should reach Claude Code.
exec 2>/dev/null

run() { "$@" || true; }

if command -v ruflo >/dev/null 2>&1; then
  run ruflo hooks "$@"
elif command -v claude-flow >/dev/null 2>&1; then
  run claude-flow hooks "$@"
else
  run npx --prefer-offline --yes ruflo@alpha hooks "$@"
fi

exit 0
