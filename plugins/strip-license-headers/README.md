# Strip License Headers Plugin

Automatically strips license headers from source files when Claude reads them, reducing token consumption and keeping context focused on actual code.

## Problem

When working with codebases that have standard license headers (Apache, MIT, GPL, proprietary, etc.), these blocks typically consume 50-150+ tokens per file. In a typical session where Claude reads dozens of files, this overhead can easily reach thousands of wasted tokens.

## Solution

This plugin intercepts the Read tool via a PreToolUse hook and:
1. Detects license headers at the beginning of source files
2. Calculates the number of lines in the header
3. Modifies the `offset` parameter to skip those lines

The result: Claude sees only the actual code, saving tokens and keeping context clean.

## Installation

Copy the plugin to your Claude Code plugins directory:

```bash
cp -r plugins/strip-license-headers ~/.claude/plugins/
```

Or symlink for development:

```bash
ln -s $(pwd)/plugins/strip-license-headers ~/.claude/plugins/strip-license-headers
```

## Configuration

Create a configuration file in your project to enable the plugin:

```bash
mkdir -p .claude
cp ~/.claude/plugins/strip-license-headers/examples/strip-license-headers.local.md .claude/
```

Or create `.claude/strip-license-headers.local.md` manually:

```yaml
---
enabled: true
---
```

**Important:** Restart Claude Code after enabling the plugin for changes to take effect.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable/disable the plugin |
| `max_header_lines` | integer | `50` | Maximum lines to scan for license headers |

## Supported File Types

- **JavaScript/TypeScript**: `.js`, `.ts`, `.tsx`, `.jsx`, `.mjs`, `.cjs`
- **Python**: `.py`, `.pyi`
- **Java/Kotlin/Scala**: `.java`, `.kt`, `.scala`
- **Go**: `.go`
- **Ruby**: `.rb`
- **Rust**: `.rs`
- **C/C++**: `.c`, `.cpp`, `.cc`, `.cxx`, `.h`, `.hpp`, `.hxx`
- **C#**: `.cs`
- **Swift**: `.swift`
- **PHP**: `.php`
- **Lua**: `.lua`
- **SQL**: `.sql`
- **Shell**: `.sh`, `.bash`
- **HTML/XML**: `.html`, `.xml`, `.vue`, `.svelte`

## Detected License Patterns

- SPDX-License-Identifier
- Apache License 2.0
- MIT License
- GNU GPL/LGPL
- BSD License
- Generic copyright blocks ("Copyright (c)", "All rights reserved")

## How It Works

The plugin uses a PreToolUse hook that:

1. **Intercepts Read calls** - Only activates for the Read tool
2. **Validates file type** - Skips non-source files
3. **Checks configuration** - Only runs when enabled
4. **Scans for headers** - Reads first 50 lines to detect license blocks
5. **Detects patterns** - Uses regex to identify license-related content
6. **Adjusts offset** - Returns `updatedInput.offset` to skip header lines

The hook is non-blocking: if anything fails, it allows the Read to proceed normally.

## Edge Cases

- **Files without headers**: No modification, reads from line 1
- **Binary files**: Detected and skipped
- **Very short files**: Not modified (less than 3 lines)
- **User-specified offset**: Respected, plugin doesn't interfere
- **Non-license comments**: Only strips blocks containing license keywords

## Performance

The plugin adds approximately 5-10ms overhead per Read operation:
- File extension check: ~0.1ms
- Config loading: ~1ms (cached after first load)
- File scanning: ~1-5ms
- Pattern matching: ~1-2ms

## Token Savings

Typical license headers consume 50-150 tokens. In a session reading 50 files with headers:
- Without plugin: ~5,000-7,500 wasted tokens
- With plugin: ~0 wasted tokens on headers

## Troubleshooting

### Plugin not working

1. Ensure the plugin is installed in `~/.claude/plugins/`
2. Verify `.claude/strip-license-headers.local.md` exists with `enabled: true`
3. Restart Claude Code
4. Check with `claude --debug` for hook execution logs

### Headers not being stripped

1. Verify the file extension is supported
2. Check that the license pattern is recognized
3. Ensure the header is at the beginning of the file
4. Try increasing `max_header_lines` if headers are very long

## License

This plugin is provided as-is for the Claude Code community.
