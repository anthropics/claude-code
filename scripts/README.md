# Repo Scripts

This directory contains helper scripts that follow the repo's safety and environment rules.

- codex-safe
  - Loads config/env (which sources the consolidated ./.env)
  - Enforces allowed root (defaults to /Users/user/dev)
  - Delegates to the codex CLI

- codex-ws
  - Convenience wrapper that cd's to the example workspace and calls codex-safe

- claude-code-safe
  - Loads config/env (which sources the consolidated ./.env)
  - Sets CLAUDE_CONFIG_DIR to /Users/user/dev/.claude
  - Enforces allowed root (defaults to /Users/user/dev)
  - Delegates to the Claude Code CLI (claude)

- claude-code-ws
  - Convenience wrapper that cd's to the example workspace and calls claude-code-safe

- with-repo-env
  - Runs any command with repo environment loaded
  - Maps GITHUB_PERSONAL_ACCESS_TOKEN from GH_TOKEN for tools that expect it

- env-check
  - Verifies presence of key variables per-tool and prints a redacted readiness summary
  - Never prints full secrets (only first 4 and last 4 characters)

Usage notes
- Prefer running agent tools from inside a workspace (e.g., workspaces/ws-example) but wrappers now allow any path under /Users/user/dev
- Secrets live only in .env at the repo root (git-ignored) and are loaded via config/env
- No containers are started by these scripts

