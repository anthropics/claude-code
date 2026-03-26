# terminal-restore

Fixes [issue #38761](https://github.com/anthropics/claude-code/issues/38761): after exiting Claude Code, terminals supporting the kitty keyboard protocol (Ghostty, Kitty, WezTerm) are left in a broken state where `Ctrl-C` and `Ctrl-D` produce raw escape sequences instead of sending SIGINT/EOF.

## Root cause

Claude Code enables the kitty keyboard protocol during TUI initialization (`GFH.enterAlternateScreen()`) and pushes it multiple times per session (on focus, redraw, and suspend/resume). On exit, the signal handlers (`SIGINT`, `SIGTERM`) call `process.exit()` without flushing terminal state, and `exitAlternateScreen()` omits the kitty protocol teardown — leaving ≥1 level on the stack.

## What this plugin does

Registers a `Stop` hook that sends two escape sequences after every session:

| Sequence | Effect |
|----------|--------|
| `\e[=0u` | Hard-disables all kitty keyboard protocol flags (works through tmux) |
| `\e[<99u` | Drains up to 99 stacked protocol levels |

Terminals that don't support kitty protocol silently ignore both sequences — no side effects.

## Workaround (without this plugin)

```bash
printf '\e[=0u'   # or: reset
```

Or add to `~/.zshrc`:

```zsh
precmd_pop_kitty_kb() { printf '\e[=0u' 2>/dev/null; }
precmd_functions+=( precmd_pop_kitty_kb )
```
