# Usage Monitor Plugin

SwiftBar-backed usage monitoring for Claude Code on macOS.

This plugin packages a small installer plus two shell scripts:

- a cached usage fetcher that drives Claude Code’s built-in `/usage` screen in a non-interactive TTY session
- a SwiftBar menu bar plugin that renders the latest cached totals and can trigger manual refreshes

## Why this plugin exists

The built-in `/usage` command is useful, but it requires opening Claude Code and checking manually. This plugin turns that same data into a glanceable macOS menu bar widget.

It is intentionally scoped to macOS because the request behind it is specifically for a SwiftBar-based monitor.

## What it installs

- `claude-usage-fetch.sh`
  - Captures `/usage` output through a scripted Claude Code session
  - Parses percentages and reset windows
  - Writes a local cache JSON file
- `claude-usage.1m.sh`
  - SwiftBar plugin that reads the cache
  - Shows the current session, weekly all-model, and weekly Sonnet usage buckets
  - Triggers background refresh when the cache is stale
- `/usage-monitor:install-swiftbar`
  - Copies the scripts into `~/.claude/plugins/usage-monitor`
  - Writes a local config file with the current project as the trusted directory
  - Symlinks the SwiftBar plugin into `~/Library/Application Support/SwiftBar/Plugins/`

## Install

1. Install dependencies:

```bash
brew install --cask swiftbar
brew install jq
```

2. In a trusted project directory, run the command:

```text
/usage-monitor:install-swiftbar
```

3. Start or refresh SwiftBar.
4. Click `Refresh now` in the menu once to seed the first cache entry.

## Display format

The menu bar title uses this format:

```text
🟢 7%(11am)┊34%(3d)┊19%(1d)
```

From left to right:

- current session usage
- weekly all-model usage
- weekly Sonnet usage

The icon color follows the highest visible percentage:

- `🟢` under 50%
- `🟡` from 50% to 79%
- `🔴` at 80% or above

## Configuration

The installer writes `~/.claude/plugins/usage-monitor/config.env`.

Supported settings:

- `CLAUDE_USAGE_MONITOR_TRUSTED_DIR`
  - Directory the fetcher `cd`s into before launching Claude Code
- `CLAUDE_USAGE_MONITOR_REFRESH_MINUTES`
  - Staleness window before the SwiftBar plugin triggers a background refresh
- `CLAUDE_USAGE_MONITOR_CLAUDE_BIN`
  - Optional explicit path to the `claude` binary

To change the trusted project later, rerun the installer command from the new directory.

## Notes

- This plugin is macOS-only.
- The fetcher only reads and caches `/usage`; it does not call any external APIs directly.
- If Claude Code, SwiftBar, or `jq` are missing, the installer exits with a clear error instead of writing a partial setup.
