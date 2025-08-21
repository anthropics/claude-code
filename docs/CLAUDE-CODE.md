# Claude Code for /Users/user/dev

This setup makes the repo root the tool “home” for Claude Code while keeping secrets in a single consolidated .env.

- Tool home: `.claude/` at the repo root (git-ignored)
- Secrets: `.env` at repo root (git-ignored). Load via `config/env` (which sources `.env`).
- Wrappers:
  - `scripts/claude-code-safe` — loads env, enforces allowed root, sets CLAUDE_CONFIG_DIR, runs `claude`
  - `scripts/claude-code-ws` — runs from workspaces/ws-example and calls the safe wrapper
- MCP: `mcp/claude-code-cli.tool.json` exposes the wrapper to MCP-aware clients

Usage
```
cd /Users/user/dev/workspaces/ws-example
/Users/user/dev/scripts/claude-code-safe --version
/Users/user/dev/scripts/claude-code-safe help
```

With a key set:
```
# Put your key in /Users/user/dev/.env (mode 600), e.g.:
# ANTHROPIC_API_KEY=sk-...
/Users/user/dev/scripts/claude-code-safe "List only top-level files; do not edit anything"
```

Notes
- Prefer wrappers for consistent env and guardrails.

