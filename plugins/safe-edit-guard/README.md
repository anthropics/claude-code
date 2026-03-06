# safe-edit-guard

A PreToolUse hook that blocks Edit and Write on files Claude hasn't Read first in the current session.

## The problem

Claude Code's most common source of regressions: editing files it hasn't read. When Claude edits blind, it guesses at file contents, overwrites working code, breaks imports, and introduces bugs based on wrong assumptions.

This happens because Claude's system prompt says "read files before editing" — but there's no enforcement. This plugin adds mechanical enforcement.

## What it does

- **Tracks** every `Read` call per session (stored in `/tmp`)
- **Blocks** `Edit`, `Write`, and `MultiEdit` on code files that haven't been read
- **Allows** writing new files (creating from scratch)
- **Allows** editing test files if the source file was read (and vice versa)
- **Ignores** non-code files (markdown, config, JSON, etc.)

## What it doesn't do

- No network calls, no external dependencies, no state beyond `/tmp`
- Doesn't block destructive shell commands (use [guard-destructive-git](../../../examples/container/guard-destructive-git) for that)
- Doesn't persist across sessions (each session starts clean)

## Install

```bash
claude plugin add safe-edit-guard
```

Or manually: copy the `safe-edit-guard` directory to `~/.claude/plugins/`.

## Guarded file types

`.py` `.js` `.ts` `.jsx` `.tsx` `.rs` `.go` `.java` `.c` `.cpp` `.h` `.hpp` `.rb` `.php` `.sh` `.sql` `.swift` `.kt` `.cs` `.vue` `.svelte`

Non-code files (`.md`, `.json`, `.yaml`, `.toml`, `.txt`, etc.) are not guarded.

## How it works

1. On every `Read` call, the file path is recorded in a session-scoped tracker (`/tmp/safe-edit-guard-{session_id}.json`)
2. On `Edit`/`Write`/`MultiEdit`, the hook checks if the target file (or a related file) was read
3. If not read: **exit 2** (blocks the tool call). Claude sees the denial and reads the file first
4. If read: **exit 0** (allows the tool call)

### Related-file matching

Reading `foo.py` also unlocks editing `test_foo.py` (and vice versa). This covers the common pattern of reading source code then writing its tests.

### Exemptions

- **New files**: `Write` to a path that doesn't exist yet is always allowed
- **Lock files**: `package-lock.json`, `yarn.lock`, `Cargo.lock`, `__init__.py`
- **Non-code files**: anything not in the guarded extensions list

## Example

```
> Edit src/utils/parser.py ...

PreToolUse hook denied: Read src/utils/parser.py before editing it.
This prevents blind edits that overwrite working code.

> Read src/utils/parser.py
(file contents shown)

> Edit src/utils/parser.py ...
(edit proceeds normally)
```
