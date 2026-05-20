# gpg-pinentry-guard

A Claude Code plugin that prevents broken GPG pinentry prompts during git commits.

## The Problem

When `commit.gpgsign=true` is configured and the GPG passphrase is not cached, `git commit` triggers `gpg-agent` which spawns a pinentry program to prompt for the passphrase. Terminal-based pinentry variants (`pinentry-curses`, `pinentry-tty`) open `/dev/tty` directly to read input.

Claude Code's Ink renderer holds exclusive control of the terminal's keyboard input. When pinentry tries to read from the same terminal, keystrokes are captured by Claude Code instead of pinentry, resulting in:

- Garbled input in the pinentry prompt
- `gpg: signing failed: No passphrase given`
- A broken commit that wastes time

## What This Plugin Does

This plugin installs a **PreToolUse hook** on the Bash tool that:

1. Detects git commands that trigger GPG signing (`git commit`, `git tag -s`, `git merge -S`)
2. Checks if GPG signing is enabled via config (`commit.gpgsign`, `tag.gpgsign`, `merge.gpgsign`)
3. Checks if the pinentry program is terminal-based (skips for GUI pinentry)
4. Checks if the passphrase is already cached in `gpg-agent` (skips if cached)
5. **Blocks the command** with actionable guidance if a broken pinentry prompt would occur

## Installation

Install as a Claude Code plugin:

```bash
claude plugin add /path/to/gpg-pinentry-guard
```

Or copy to your plugins directory:

```bash
cp -r gpg-pinentry-guard ~/.claude/plugins/
```

## Workarounds (Without This Plugin)

If you prefer not to install this plugin, you can work around the issue:

### Cache passphrase before starting Claude Code

```bash
echo "test" | gpg --clearsign > /dev/null
```

### Switch to a GUI pinentry

```bash
# ~/.gnupg/gpg-agent.conf
pinentry-program /usr/bin/pinentry-gnome3
```

Then reload: `gpgconf --reload gpg-agent`

### Increase cache timeout

```bash
# ~/.gnupg/gpg-agent.conf
default-cache-ttl 86400
max-cache-ttl 86400
```

Then reload: `gpgconf --reload gpg-agent`

## Requirements

- `git`, `gpg`, `jq` (standard on most systems)
- `gpg-connect-agent` (part of GnuPG)

## Limitations

This plugin is a **workaround**, not a fix. The underlying issue is that Claude Code's terminal renderer does not release keyboard control for interactive subprocesses. A proper fix requires changes to Claude Code's Bash tool to temporarily pause the Ink renderer when a subprocess needs terminal access.
