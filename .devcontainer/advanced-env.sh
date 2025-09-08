# Advanced Claude Code Environment Configuration

# Enable all experimental features
export CLAUDE_EXPERIMENTAL_FEATURES=true
export CLAUDE_ALPHA_FEATURES=true
export CLAUDE_BETA_FEATURES=true

# Performance optimization
export NODE_OPTIONS="--max-old-space-size=8192 --experimental-modules --experimental-specifier-resolution=node"
export UV_THREADPOOL_SIZE=16

# Git configuration with experimental features
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global fetch.prune true
git config --global diff.colorMoved zebra
git config --global merge.conflictstyle diff3
git config --global core.pager delta
git config --global interactive.diffFilter "delta --color-only"
git config --global delta.navigate true
git config --global delta.light false
git config --global delta.side-by-side true
git config --global delta.line-numbers true
git config --global delta.syntax-theme "Dracula"

# Advanced editor settings
export EDITOR="nano"
export VISUAL="nano"
export GIT_EDITOR="nano"

# FZF configuration with advanced options
export FZF_DEFAULT_OPTS="--height 40% --reverse --border --multi --inline-info --preview 'bat --style=numbers --color=always --line-range :500 {}'"
export FZF_CTRL_T_OPTS="--preview 'bat --style=numbers --color=always --line-range :500 {}'"
export FZF_ALT_C_OPTS="--preview 'tree -C {} | head -200'"

# History configuration
export HISTSIZE=50000
export SAVEHIST=50000
export HISTFILE=/commandhistory/.zsh_history

# Development tool aliases
alias ll='exa -alF --color=always --group-directories-first'
alias la='exa -a --color=always --group-directories-first'
alias l='exa -F --color=always --group-directories-first'
alias ls='exa --color=always --group-directories-first'
alias tree='exa --tree --color=always'

# Git aliases with experimental features
alias g='git'
alias ga='git add'
alias gaa='git add --all'
alias gc='git commit -v'
alias gca='git commit -v --amend'
alias gcm='git commit -m'
alias gco='git checkout'
alias gd='git diff'
alias gf='git fetch'
alias gl='git pull'
alias gp='git push'
alias gs='git status'
alias lg='lazygit'

# Claude-specific aliases
alias claude-config='nano ~/.claude/config.json'
alias claude-experimental='CLAUDE_EXPERIMENTAL_FEATURES=true claude'
alias claude-debug='CLAUDE_DEBUG=true claude'

# Development workflow aliases
alias dev-start='npm run dev'
alias dev-test='npm test'
alias dev-build='npm run build'
alias dev-lint='npm run lint'

# Docker aliases
alias d='docker'
alias dc='docker-compose'
alias dp='docker ps'
alias di='docker images'

# Python aliases (if Python is available)
alias py='python3'
alias pip='pip3'

# Advanced file operations
alias cat='bat'
alias find='fd'
alias grep='rg'

# System monitoring
alias top='htop'
alias ps='ps aux'
alias ports='netstat -tuln'

# Quick navigation
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'

echo "🚀 Advanced Claude Code Environment Loaded!"
echo "💡 Type 'claude --help' for available commands"
echo "🔧 Type 'claude-config' to edit configuration"
echo "📊 Available tools: lazygit, starship, gh copilot, bat, exa, ripgrep, fd"