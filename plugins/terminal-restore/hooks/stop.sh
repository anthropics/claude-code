#!/usr/bin/env bash
# terminal-restore: stop hook
#
# Root cause (issue #38761): Claude Code enables the kitty keyboard protocol
# via the GFH class during TUI init but never sends the pop/disable sequences
# on exit. Signal handlers (SIGINT/SIGTERM) call process.exit() without cleanup,
# and exitAlternateScreen() omits the kitty protocol teardown.
#
# Fix: send both sequences — \e[=0u disables all flags (works through tmux),
# \e[<u pops the stack. We drain up to 10 levels to handle multiple pushes.

# Consume stdin (hook API requires reading it)
read -r -d '' _INPUT < /dev/stdin 2>/dev/null || true

# Only act on TTY — skip in non-interactive/piped contexts
if [ -t 1 ]; then
  printf '\e[=0u'   # hard-disable all kitty keyboard protocol flags
  printf '\e[<10u'  # drain up to 10 stacked levels (safe no-op if fewer)
fi

exit 0
