# Update Checker Plugin

Detects how Claude Code was installed and checks the **correct package source**
for available updates. This addresses the false-positive "Update available!"
banner that appears for Homebrew and WinGet users when the npm registry is ahead
of their package manager ([#18047](https://github.com/anthropics/claude-code/issues/18047)).

## What it does

At the start of each session, the plugin:

1. Reads the installed Claude Code version.
2. Detects the installation method (Homebrew, WinGet, or npm).
3. Queries that package source for the latest available version.
4. Reports whether the update banner is accurate or a false positive.

The result is injected as session context so Claude is aware of the real update
status.

## Supported installation methods

| Method   | Detection                     | Version source               |
|----------|-------------------------------|------------------------------|
| Homebrew | `brew info --cask claude-code`| Homebrew cask formula        |
| WinGet   | `winget show`                 | WinGet manifest              |
| npm      | `npm view`                    | npm registry                 |

If the installation method cannot be detected, the plugin exits silently and
does not add any context.

## Usage

Install the plugin, then start a session as usual. No configuration needed.

When the plugin detects a false positive it adds context like:

> Update check (homebrew): Claude Code 2.1.73 is the latest version available
> via homebrew. If you see an 'Update available' banner it is a false positive
> caused by the npm registry being ahead of your package manager.

## Limitations

- The plugin provides **informational context only** -- it cannot suppress the
  built-in update banner. To hide the banner entirely, set
  `DISABLE_AUTOUPDATER=1` (see the main README for details).
- Version checks add a few seconds to session startup (configurable via
  the `timeout` setting in `hooks.json`, default 15 s).
- On Windows/WSL, WinGet detection requires `winget.exe` to be accessible from
  the shell.