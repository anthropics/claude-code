# tmp-cwd-cleanup

A workaround plugin for [issue #8856](https://github.com/anthropics/claude-code/issues/8856): the Bash tool creates a `/tmp/claude-<hex>-cwd` file after every shell command to track the working directory, but never deletes it. On active systems these files accumulate into the thousands and eventually slow down `/tmp` lookups.

## What it does

Registers a **Stop hook** that deletes all `/tmp/claude-*-cwd` files owned by the current user when the Claude Code session ends.

```
/tmp/claude-02a6-cwd   (22 bytes — deleted on exit)
/tmp/claude-1f3b-cwd   (22 bytes — deleted on exit)
...
```

## Installation

Install via the `/plugin` command inside Claude Code:

```
/plugin install tmp-cwd-cleanup
```

Or add it manually to your `.claude/settings.json`:

```json
{
  "plugins": ["tmp-cwd-cleanup"]
}
```

## Notes

- Only removes files owned by the **current user** (safe on shared systems).
- Exits `0` so it never blocks session teardown.
- This plugin is a stopgap; the proper fix is to call `unlinkSync` in the Bash tool implementation immediately after reading the cwd file ([upstream tracking issue #8856](https://github.com/anthropics/claude-code/issues/8856)).

## Hook

| Event | Matcher | Effect |
|-------|---------|--------|
| `Stop` | _(all)_ | Deletes `/tmp/claude-*-cwd` files owned by current user |
