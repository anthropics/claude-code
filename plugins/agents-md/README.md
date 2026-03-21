# agents-md

Automatically loads `AGENTS.md` files into Claude Code's context at session start, making it compatible with the cross-tool agent instruction standard used by Cursor, OpenAI Codex, Amp, and others.

**Fixes:** [#6235 – Feature Request: Support AGENTS.md](https://github.com/anthropics/claude-code/issues/6235)

## The problem

Claude Code reads `CLAUDE.md` (and `CLAUDE.local.md`) from the project directory tree to understand project-specific instructions. Most other AI coding tools use `AGENTS.md` for the same purpose — this is coalescing into a [cross-tool standard](https://agents.md/).

Without this plugin, teams that use both Claude Code and other tools must either:
- Maintain two separate instruction files (`CLAUDE.md` and `AGENTS.md`) in sync, or
- Symlink one to the other (fragile on Windows, confusing for contributors)

## What this plugin does

Registers a `SessionStart` hook that mirrors Claude Code's own `CLAUDE.md` discovery logic:

1. Walks up the directory tree from the project root, collecting every `AGENTS.md` found.
2. Also checks `~/.claude/AGENTS.md` for user-level instructions.
3. Injects all found content as `additionalContext` — the same mechanism used internally for `CLAUDE.md`.

The file lookup order (lowest → highest priority) matches `CLAUDE.md` precedence:

```
~/.claude/AGENTS.md          ← user-level (lowest priority)
/path/to/repo/AGENTS.md      ← repo root
/path/to/repo/subdir/AGENTS.md  ← subdirectory (highest priority)
```

## Installation

Install via the `/plugin` command inside Claude Code:

```
/plugin install agents-md
```

Or add it manually to your `.claude/settings.json`:

```json
{
  "plugins": ["agents-md"]
}
```

## Usage

Just drop an `AGENTS.md` in your project root (the same place you'd put `CLAUDE.md`) and start a Claude Code session. The file is loaded automatically — no configuration needed.

```
my-project/
├── AGENTS.md      ← loaded by this plugin (and by Cursor, Codex, Amp, …)
├── CLAUDE.md      ← loaded natively by Claude Code
└── src/
```

Both files are loaded; `CLAUDE.md` instructions take precedence where they overlap.

## Hook

| Event | Effect |
|-------|--------|
| `SessionStart` | Finds and injects `AGENTS.md` file(s) as `additionalContext` |
