# Claude Code CLI Shell Completions

This directory contains tab completion scripts for the `claude` command in bash, fish, and zsh shells.

## Installation

### Bash Completion

```bash
# Copy the completion script to a completion directory
sudo cp claude-completions.bash /etc/bash_completion.d/claude

# Or for user-only installation:
mkdir -p ~/.local/share/bash-completion/completions
cp claude-completions.bash ~/.local/share/bash-completion/completions/claude

# Reload bash completions
source /etc/bash_completion
# or restart your shell
```

### Fish Completion

```bash
# Copy to fish completions directory
mkdir -p ~/.config/fish/completions
cp claude-completions.fish ~/.config/fish/completions/claude.fish

# Fish will automatically load the completions
```

### Zsh Completion

```zsh
# Copy to a directory in your fpath
mkdir -p ~/.local/share/zsh/site-functions
cp claude-completions.zsh ~/.local/share/zsh/site-functions/_claude

# Add to your ~/.zshrc if not already present:
fpath=(~/.local/share/zsh/site-functions $fpath)

# Reload completions
autoload -U compinit && compinit
```

## Features

All completion scripts support:

- ✅ Main command options (-d, --debug, --print, etc.)
- ✅ All subcommands (config, mcp, install, etc.)
- ✅ Nested subcommand options (config get/set, mcp add/remove)
- ✅ File/directory completion for relevant flags (--settings, --add-dir, --mcp-config)
- ✅ Choice completion for enums (--output-format, --permission-mode, --transport)
- ✅ Model name suggestions for --model and --fallback-model flags
- ✅ Help text and descriptions for all options

## Usage Examples

After installation, you can use tab completion:

```bash
claude <TAB>                    # Shows: config, mcp, install, etc.
claude --<TAB>                  # Shows all global options
claude config <TAB>             # Shows: get, set, list, add, etc.
claude mcp add --<TAB>          # Shows: --scope, --transport, etc.
claude --output-format <TAB>    # Shows: text, json, stream-json
claude --model <TAB>            # Shows: sonnet, opus, haiku, etc.
```

## Testing

Test the completions by typing commands and pressing Tab:

- Basic command completion
- Option flag completion  
- Subcommand completion
- Value completion for choice-based options
- File/directory completion for path options

The completion scripts handle complex nested command structures and provide context-aware suggestions.
