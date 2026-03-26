#!/usr/bin/env bash
# terminal-restore: stop hook
#
# Root cause (issue #38761): Claude Code enables the kitty keyboard protocol
# via the GFH class during TUI init but never sends the pop/disable sequences
# on exit. Signal handlers (SIGINT/SIGTERM) call process.exit() without cleanup,
# and exitAlternateScreen() omits the kitty protocol teardown.
# Claude Code also pushes the protocol multiple times per session (focus,
# redraw, suspend/resume) without a matching pop count on exit.
#
# Fix: \e[=0u hard-disables all flags (reliable through tmux).
# \e[<99u drains up to 99 stacked levels — the community-validated maximum
# (see issue #38840 and workaround at https://github.com/anthropics/claude-code/issues/38761).
# Terminals that don't support kitty protocol silently ignore both sequences.

# Consume stdin (hook API requires reading it)
HOOK_INPUT=$(cat)

# Only act on TTY — skip in non-interactive/piped contexts
if [ -t 1 ]; then
  printf '\e[=0u'   # hard-disable all kitty keyboard protocol flags
  printf '\e[<99u'  # drain full stack (safe no-op on non-kitty terminals)
fi

exit 0
