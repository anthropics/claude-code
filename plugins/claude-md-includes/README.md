# claude-md-includes

A Claude Code plugin that processes `@include` directives in CLAUDE.md files, enabling composable instruction files.

## Problem

- Language-specific rules (Elixir, Go, Rust) must be duplicated across projects
- Global CLAUDE.md wastes context on irrelevant instructions
- No way to mix shared templates with project-specific content

## Solution

This plugin runs at session start and:
1. Reads the project's `./CLAUDE.md` file
2. Recursively processes `@include <path>` directives
3. Outputs merged content via `additionalContext`

## Installation

```bash
claude plugin add /path/to/plugins/claude-md-includes
```

Or add to your Claude Code settings.

## Usage

Add `@include` directives at the start of lines in your CLAUDE.md:

```markdown
@include ~/.claude/languages/elixir.md
@include ./shared/patterns.md

## Project-Specific Content

Your project-specific instructions here...
```

### Path Resolution

| Path Type | Example | Resolution |
|-----------|---------|------------|
| Home directory | `~/path/file.md` | Expands `~` to home directory |
| Relative | `./docs/rules.md` | Relative to including file |
| Relative (no ./) | `shared/rules.md` | Relative to including file |
| Absolute | `/etc/claude/rules.md` | Used as-is |

### Recursive Includes

Included files can themselves contain `@include` directives:

```markdown
# ~/.claude/languages/elixir.md
@include ~/.claude/shared/functional-patterns.md
@include ~/.claude/shared/testing-patterns.md

## Elixir-Specific Rules
...
```

## Edge Cases

| Case | Behavior |
|------|----------|
| Missing file | Warns to stderr, continues processing |
| Circular include | Warns to stderr, stops that branch |
| Invalid path | Warns to stderr, skips |
| Empty @include | Skips line |
| @include mid-line | Not processed (must be at line start) |
| @include in code block | Not processed (preserved as-is) |
| Max depth exceeded | Warns at depth 10, stops recursion |
| Path with spaces | Supported (e.g., `@include ~/my docs/file.md`) |
| Path traversal attack | Blocked with security warning |

## Security

The plugin validates all include paths to prevent directory traversal attacks:

**Allowed locations:**
- Within the project directory (and subdirectories)
- Within `~/.claude/` (user's Claude config directory)
- Other readable paths (excluding system directories)

**Blocked locations:**
- `/etc/`, `/var/`, `/usr/`, `/sys/`, `/proc/`
- Any path using `../` to escape allowed boundaries

**Example blocked paths:**
```markdown
@include ../../../etc/passwd           # Blocked: system directory
@include /etc/shadow                   # Blocked: sensitive system file
```

## Code Blocks

The `@include` directive is **not processed** inside markdown code blocks:

````markdown
This @include ~/.claude/rules.md will be processed.

```markdown
# Example documentation
@include ~/.claude/example.md  # This is preserved as-is (not processed)
```

This @include ~/.claude/more.md will also be processed.
````

## Example Setup

### 1. Create shared language files

```bash
mkdir -p ~/.claude/languages
```

**~/.claude/languages/elixir.md:**
```markdown
## Elixir Development

- Use `mix format` before committing
- Pattern match in function heads
- Use typespecs for public functions
```

**~/.claude/languages/phoenix.md:**
```markdown
@include ~/.claude/languages/elixir.md

## Phoenix Framework

- Always use `to_form/2` pattern
- Use streams for collections
- Wrap templates in `<Layouts.app>`
```

### 2. Use in project CLAUDE.md

```markdown
@include ~/.claude/languages/phoenix.md

## My Phoenix Project

Project-specific rules here...
```

### 3. Start Claude Code

The plugin automatically processes includes at session start.

## Requirements

- Python 3.6+
- Claude Code with plugin support

## Notes

- This is a workaround until native `@include` support is added to Claude Code
- The native `@path/to/file.md` syntax (added in v0.2.107) only works for file references in prompts, not recursive includes in CLAUDE.md
- Plugin runs at session start, so changes require restarting Claude Code
