# Shell completions for the `claude` CLI

Tab completion for [Claude Code](https://code.claude.com/docs/en/overview) in bash, zsh, and fish.

Instead of hard-coding flag and subcommand lists (which would go stale on every release), these scripts parse the output of `claude --help` at completion time, so completions always match the installed version of Claude Code — including nested subcommands like `claude mcp add` or `claude plugin marketplace`. Parsed help output is cached per CLI version under `${XDG_CACHE_HOME:-~/.cache}/claude-code-completions/`, so after the first use completions are instant.

What you get:

- Subcommand completion with descriptions (`claude <TAB>`, `claude mcp <TAB>`, `claude plugin marketplace <TAB>`, ...)
- Flag completion with descriptions (`claude --<TAB>`, `claude mcp add --<TAB>`, ...)
- Value completion for enum flags (`--model`, `--permission-mode`, `--output-format`, `--effort`, `--scope`, `--transport`, ...)
- Directory/file completion for path flags (`--add-dir`, `--settings`, `--mcp-config`, ...)

## Install

### Bash

Source the script from your `~/.bashrc`:

```bash
echo "source /path/to/claude-code/completions/claude.bash" >> ~/.bashrc
```

Or copy it into your bash-completion directory so it loads on demand:

```bash
# Linux
cp completions/claude.bash /etc/bash_completion.d/claude
# macOS with Homebrew bash-completion
cp completions/claude.bash "$(brew --prefix)/etc/bash_completion.d/claude"
```

### Zsh

Copy `_claude` into any directory on your `$fpath` (before `compinit` runs):

```zsh
mkdir -p ~/.zsh/completions
cp completions/_claude ~/.zsh/completions/_claude
```

Then make sure your `~/.zshrc` contains (order matters — `fpath` must be set before `compinit`):

```zsh
fpath=(~/.zsh/completions $fpath)
autoload -Uz compinit && compinit
```

### Fish

```fish
cp completions/claude.fish ~/.config/fish/completions/claude.fish
```

Completions are picked up automatically in new fish sessions — no configuration needed. This also shadows the static `claude` completions bundled with recent fish releases, which go stale as the CLI evolves.

## How it works

1. On first completion, the script runs `claude --help` (and `claude <subcommand> --help` as you descend into subcommands) and caches the output under `${XDG_CACHE_HOME:-~/.cache}/claude-code-completions/<version>/`.
2. The `Commands:` and `Options:` sections are parsed with `awk` into completion candidates, including descriptions where the shell supports them (zsh and fish).
3. The cache is keyed by `claude -v`, so upgrading Claude Code automatically produces fresh completions; stale caches for old versions can be safely deleted at any time:

```sh
rm -rf "${XDG_CACHE_HOME:-$HOME/.cache}/claude-code-completions"
```

The scripts only ever execute `claude --help`, `claude -v`, and `claude <known-subcommand...> --help` — a word typed on the command line is only passed to `claude` if a previous help output listed it as a subcommand.

## Compatibility

- bash 3.2+ (works with the stock macOS bash; no bash-completion package required)
- zsh 5.x with `compinit`
- fish 3.4+
- Requires `awk` (BSD or GNU) — present on every supported platform
