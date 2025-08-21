# Agent environment: shared dev root and single .env

Overview
- Shared dev root: /Users/user/dev is the working root for all local AI agents and tools (Claude Code, Codex, EOS, etc.).
- Secrets: A single consolidated .env at repo root provides all keys and defaults. This file is git-ignored and set to mode 600.
- Loader: config/env sources .env and exports variables for all agents.
- Homes: Each tool keeps its local state in repo-local, git-ignored directories:
  - .claude/ — Claude Code state/config
  - .codex/ — Codex CLI state/config
  - mcp/ — shared MCP manifests consumed by multiple tools

Conventions
- Never commit secrets. All keys live only in /Users/user/dev/.env.
- Wrappers under scripts/ load config/env, so all tools receive the same environment.
- Default allowed root for wrappers is the repo root (/Users/user/dev) to support a shared workspace. You may override ALLOWED_ROOT/CODEX_ALLOWED_ROOT for stricter runs.

Required keys (examples)
- ANTHROPIC_API_KEY=sk-...
- OPENAI_API_KEY=sk-...
- GITHUB_PERSONAL_ACCESS_TOKEN=github_pat_...
- Optional defaults: OPENAI_MODEL=o4, CLAUDE_MODEL=claude-3.7-sonnet, CODEX_DEFAULT_MODEL=o4

Usage
- For Claude Code:
  - scripts/claude-code-safe --help
  - scripts/claude-code-ws --help (runs from workspaces/ws-example)
- For Codex:
  - scripts/codex-safe --help
  - scripts/codex-ws --help (runs from workspaces/ws-example)

Security
- .env permissions must be 600. Do not print or log secrets. Any previews must redact all but first/last 4 characters.
- .claude and .codex directories are repo-local and git-ignored; they may contain non-secret runtime state.

EOS
- EOS compose files load env via config/env to ensure agents share the same secret source.

Quick tested commands
- Codex (non-interactive exec):
  - scripts/codex-safe exec -m gpt-4o "Reply only with: OK (Codex gpt-4o)"
- Claude Code (print a single response):
  - scripts/claude-code-safe --print "Reply only with: OK (Claude claude-3-opus)"

Defaults currently configured
- OPENAI_MODEL=gpt-5
- CODEX_DEFAULT_MODEL=gpt-4o
- CLAUDE_MODEL=claude-3-opus

Cross-platform bootstrap (any host)
- Goal: reproduce the same environment model (shared dev root, single .env, wrappers) on Linux, macOS, or Windows without changing IDE defaults.

1) Clone the repo (this directory will be your DEV_ROOT)
- Examples:
  - Linux/macOS: /opt/dev or /home/you/dev or /Users/you/dev
  - Windows: C:\\Users\\you\\dev or use WSL (e.g., /home/you/dev)

2) Create a consolidated .env at the repo root
- File: <repo>/.env (permissions 600 on Unix)
- Keys (minimum): OPENAI_API_KEY, ANTHROPIC_API_KEY, GITHUB_PERSONAL_ACCESS_TOKEN
- Optional defaults: OPENAI_MODEL, CLAUDE_MODEL, CODEX_DEFAULT_MODEL

3) Ensure your shell loads the repo environment
- zsh (Linux/macOS): add to ~/.zshrc
  ```bash path=null start=null
  export DEV_ROOT="/absolute/path/to/repo"
  [ -f "$DEV_ROOT/config/env" ] && . "$DEV_ROOT/config/env"
  ```
- bash (Linux/macOS): add to ~/.bashrc or ~/.profile
  ```bash path=null start=null
  export DEV_ROOT="/absolute/path/to/repo"
  if [ -f "$DEV_ROOT/config/env" ]; then . "$DEV_ROOT/config/env"; fi
  ```
- PowerShell (Windows): add to $PROFILE (e.g., Documents\PowerShell\Microsoft.PowerShell_profile.ps1)
  ```powershell path=null start=null
  $Env:DEV_ROOT = "C:\\absolute\\path\\to\\repo"
  # Bash-based wrappers run best under Git Bash or WSL. For PowerShell-only workflows,
  # prefer invoking tools that natively support Windows or call into WSL/Git Bash.
  ```
- Optional hardening on zsh: setopt NO_NOMATCH; unsetopt BANG_HIST RC_QUOTES; enable bracketed-paste-magic if available.

4) Optional: use direnv (project-scoped loading)
- At repo root, .envrc already sources config/env. Enable with:
  ```bash path=null start=null
  direnv allow
  ```
- This avoids touching global shells if you prefer per-repo activation.

5) Install CLIs (user scope)
- Claude Code CLI (Linux/macOS/Windows via Node):
  ```bash path=null start=null
  npm install -g @anthropic-ai/claude-code
  ```
- Codex CLI:
  ```bash path=null start=null
  # Follow provider instructions so `codex` is on PATH (or available in WSL/Git Bash on Windows)
  ```

6) Verify (masked)
- From the repo root (bash/zsh or WSL/Git Bash on Windows):
  ```bash path=null start=null
  scripts/env-check
  scripts/claude-code-safe --version
  scripts/codex-safe --help
  ```
- You should see masked keys and CLI versions.

Notes
- Do not modify IDE defaults. The shell initialization (or direnv) ensures consistent loading across terminals and tools.
- Windows: wrappers are bash scripts; prefer WSL or Git Bash to run them. PowerShell can be used to set DEV_ROOT and call WSL/Git Bash as needed.
- CI remains separate and should use platform secrets (e.g., GitHub Actions secrets) rather than this local .env.
- Wrappers default allowed root to the repo root. Override per-session with ALLOWED_ROOT/CODEX_ALLOWED_ROOT when needed.

VS Code tips (project-level)
- These are already set in .vscode/settings.json for this repo:
  - MCP: enabled, discovery on, autostart on; manifests discovered via mcp/*.json and mcp/**/*.json
  - Formatting: formatOnSave enabled; Prettier enabled
  - Telemetry: disabled
  - Terminal: Warp.app as external terminal on macOS; integrated default shell zsh
- If you use Windows, prefer opening this repo in WSL or run wrappers via Git Bash. PowerShell can set DEV_ROOT but wrappers expect bash/zsh.

