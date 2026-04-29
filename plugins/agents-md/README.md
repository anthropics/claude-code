# agents-md

Adds [AGENTS.md](https://github.com/anthropics/claude-code/issues/6235) support
to Claude Code, enabling cross-tool compatibility with Codex, Cursor, Amp, and
other AI coding tools that use the `AGENTS.md` standard.

## Problem

Over 20,000 open-source repositories use `AGENTS.md` to provide instructions to
AI coding assistants. Claude Code only reads `CLAUDE.md` files, which means it
ignores project-level AI instructions when working on these repositories.

See: [anthropics/claude-code#6235](https://github.com/anthropics/claude-code/issues/6235)

## How it works

This plugin uses a `SessionStart` hook to detect and load `AGENTS.md` files as a
fallback:

1. On session start, the hook walks from CWD up to the filesystem root
2. At each directory level, it checks for `CLAUDE.md`, `.claude/CLAUDE.md`, or
   `CLAUDE.local.md`
3. If any Claude-specific file exists at that level, `AGENTS.md` is **skipped**
4. If only `AGENTS.md` exists, its content is loaded into Claude's context

This mirrors Claude Code's native CLAUDE.md loading order (root-first) and
respects the priority hierarchy.

### Lookup locations

For each directory from root to CWD:

- `<dir>/AGENTS.md`
- `<dir>/.claude/AGENTS.md`

### Behavior matrix

| CLAUDE.md exists | AGENTS.md exists | Result                                  |
| :--------------: | :--------------: | --------------------------------------- |
|       Yes        |       Yes        | Only CLAUDE.md is used (native)         |
|       Yes        |        No        | Only CLAUDE.md is used (native)         |
|        No        |       Yes        | **AGENTS.md is loaded by this plugin**  |
|        No        |        No        | Nothing loaded                          |

## Requirements

- Python 3 (`python3 --version`)

## Limitations

- Content is injected via `additionalContext`, not through the native CLAUDE.md
  pipeline. This means it won't appear in `/memory` views or support `@include`
  syntax.
- The `AGENTS.md` content does not support frontmatter `paths:` conditional
  rules.
- Maximum content size is capped at 40,000 characters (matching CLAUDE.md's
  warning threshold).
