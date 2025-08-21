# Codex CLI for /Users/user/dev

This repo-local setup wires the Codex CLI as a coding assistant with safe defaults.

- Secrets/config live in a single `.env` at the repo root (git-ignored). Do not commit secrets.
- Default allowed root: `/Users/user/dev`. Override with `CODEX_ALLOWED_ROOT` if needed.
- No containers are started by this setup. It is independent of `eos/compose`.

## Files
- `.env` — holds `CODEX_API_KEY`, optional `CODEX_BASE_URL`, `CODEX_DEFAULT_MODEL`, and safety settings.
- `scripts/codex-safe` — wrapper that loads env, enforces allowed root, and delegates to `codex`.
- `scripts/codex-ws` — convenience wrapper that runs from the example workspace.
- `mcp/codex-cli.tool.json` (optional) — exposes `scripts/codex-safe` as a command tool for MCP-aware clients.

## Usage
```
cd /Users/user/dev/workspaces/ws-example
/Users/user/dev/scripts/codex-safe --help
```

To run with a profile or specific model without editing config files, you can pass flags directly:
```
/Users/user/dev/scripts/codex-safe -m coder-1 exec "List project files and propose a README update plan."
```

Populate your API key locally (do not commit): edit `/Users/user/dev/.env` and set `CODEX_API_KEY=...`.

