# tmp-cleanup

A Claude Code plugin that automatically removes orphaned `/tmp/claude-*-cwd`
working directory tracking files when a session ends.

## Background

The Bash tool creates a temporary file at `/tmp/claude-{random-hex}-cwd` for
every invocation to persist the current working directory across commands.
These files are never cleaned up by the core tool, causing hundreds (sometimes
thousands) of orphaned files to accumulate over time — see
[issue #8856](https://github.com/anthropics/claude-code/issues/8856).

## How it works

This plugin registers a `Stop` hook that fires when Claude Code exits normally.
It deletes all `/tmp/claude-*-cwd` files and logs the count if any were removed.
Files that cannot be removed (e.g. permission errors) are silently skipped so
the hook never blocks the stop event.

For sessions terminated by a crash or signal, the next clean `Stop` event will
pick up and delete any leftover files, including those older than one hour that
can be considered safely orphaned.

## Installation

```bash
claude plugins install tmp-cleanup
```

Or place the `tmp-cleanup/` directory in your project's `.claude/plugins/`
folder to scope it to a single project.
