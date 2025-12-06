# Auto-Format Plugin

Automatically format code files after Claude Code writes or edits them.

## Overview

This plugin uses a PostToolUse hook to automatically run the appropriate code formatter whenever Claude Code writes or edits a file. This ensures that all code generated or modified by Claude consistently follows your project's formatting standards.

**Key Features:**
- Runs automatically after Write/Edit operations
- Intelligently finds local or global formatters
- Supports 8 programming languages and 20+ file types
- Never blocks Claude operations
- Zero configuration needed

## How It Works

**Hook Type:** PostToolUse

**Triggers on:** Write, Edit tools

**Behavior:** After Claude writes or edits a file, the hook:
1. Detects the file type from the extension
2. Automatically searches for the appropriate formatter:
   - For Node.js tools (prettier): tries `npx` first (finds local node_modules), then global installation
   - For other tools: checks global installation via `which`
3. Runs the formatter if found
4. Silently continues if no formatter is found

**Important:**
- This hook never blocks Claude's operations
- If formatting fails or no formatter is available, the file is left as-is
- For JavaScript/TypeScript projects, it automatically uses your local prettier from node_modules if available

## Supported Formatters

The plugin supports **8 formatters** covering **23 file extensions**:

### JavaScript/TypeScript Ecosystem - [prettier](https://prettier.io/)
**13 file types:** `.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.css`, `.scss`, `.less`, `.html`, `.vue`, `.md`, `.yaml`, `.yml`

### Python - [black](https://black.readthedocs.io/)
**1 file type:** `.py`

### Go - [gofmt](https://golang.org/cmd/gofmt/)
**1 file type:** `.go`

### Rust - [rustfmt](https://rust-lang.github.io/rustfmt/)
**1 file type:** `.rs`

### C/C++ - [clang-format](https://clang.llvm.org/docs/ClangFormat.html)
**7 file types:** `.c`, `.cpp`, `.cc`, `.cxx`, `.h`, `.hpp`, `.java`

### Ruby - [rubocop](https://rubocop.org/)
**1 file type:** `.rb`

### Elixir - [mix format](https://hexdocs.pm/mix/main/Mix.Tasks.Format.html)
**2 file types:** `.ex`, `.exs`

### Terraform - [terraform fmt](https://www.terraform.io/docs/commands/fmt.html)
**1 file type:** `.tf`

---

**Total:** 8 formatters, 23 file extensions

## Installation

### 1. Install Formatters

Install the formatters you need:

```bash
# JavaScript/TypeScript
npm install -g prettier              # Global
npm install --save-dev prettier      # Local (recommended)

# Python
pip install black

# Go (included with Go installation)
# Rust (included with Rust installation)
rustup component add rustfmt

# C/C++/Java
brew install clang-format            # macOS
sudo apt install clang-format        # Linux

# Ruby
gem install rubocop

# Elixir (included with Elixir installation)
# Terraform (included with Terraform installation)
```

### 2. Enable the Plugin

Add to your `.claude/settings.json` (project) or `~/.claude/settings.json` (global):

```json
{
  "plugins": ["auto-format"]
}
```

## Configuration

### Disable Auto-Formatting

Set the environment variable to disable auto-formatting:

```bash
export AUTO_FORMAT_ENABLED=0
```

To re-enable:

```bash
export AUTO_FORMAT_ENABLED=1
# or unset it
unset AUTO_FORMAT_ENABLED
```

### Enable Debug Logging

To see detailed logs of what the formatter is doing:

```bash
export AUTO_FORMAT_DEBUG=1
```

Debug logs are written to `/tmp/auto-format-hook.log`.

### Formatter Configuration Files

The hook respects formatter configuration files in your project:

- **Prettier:** `.prettierrc`, `.prettierrc.json`, `prettier.config.js`, etc.
- **Black:** `pyproject.toml`, `.black.toml`
- **Rustfmt:** `rustfmt.toml`, `.rustfmt.toml`
- **Clang-Format:** `.clang-format`
- **Rubocop:** `.rubocop.yml`

Place these configuration files in your project root to customize formatting rules.

## Example Usage

### Before Auto-Format Plugin

```bash
# Claude writes code
claude> "Create a React component"

# You must manually format
npx prettier --write Component.tsx

# Time wasted: ~30 seconds per file
```

### With Auto-Format Plugin

```bash
# Claude writes code
claude> "Create a React component"

# ✨ Automatically formatted!
# No manual intervention needed
```

### Multi-Language Support

The plugin automatically detects file type and uses the correct formatter:

| File Type | Formatter Used | Auto-Detects Local |
|-----------|----------------|-------------------|
| `Component.tsx` | prettier | ✅ Yes (via npx) |
| `api.py` | black | - |
| `main.go` | gofmt | - |
| `lib.rs` | rustfmt | - |
| `config.json` | prettier | ✅ Yes (via npx) |

## Benefits

- **Save Time:** Eliminates 20-30 seconds of manual formatting per file
- **Consistent Style:** All code follows project formatting standards
- **Prevent CI Failures:** Code is pre-formatted before commits
- **Better Reviews:** Git diffs show only logical changes, not formatting
- **Zero Friction:** Works automatically, never blocks Claude operations

## Troubleshooting

### Check if Formatter is Installed

```bash
which prettier  # JavaScript/TypeScript
which black     # Python
which gofmt     # Go
```

### Enable Debug Logging

```bash
export AUTO_FORMAT_DEBUG=1
# Check logs at: /tmp/auto-format-hook.log
```

### Formatter Not Running?

- Verify formatter is installed
- Check `.claude/settings.json` includes `"auto-format"` in plugins
- Enable debug mode to see detailed logs

**Note:** The hook never blocks Claude operations. If formatting fails, the file is left as-is and Claude continues normally.

## Advanced: Adding Custom Formatters

Edit `plugins/auto-format/hooks/auto_formatter.py`:

```python
FORMATTERS = {
    # Add your formatter
    "ext": {
        "cmd": ["formatter-name", "--write"],
        "check": "formatter-name"
    },
}
```

## Learn More

- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks)
- [Plugin Development Guide](https://code.claude.com/docs/en/plugins)
