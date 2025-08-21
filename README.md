# dev monorepo — Podman-first, agent-first (EOS + tools)

Welcome. This is a tool-agnostic monorepo that hosts EOS and your working projects.
No installs are performed from here; this README only explains the layout and how to proceed.

## Top-level map
- eos/ — EOS runtime: core agents and compose files
- workspaces/ — vendor-neutral working folders (example: ws-example)
- config/ — shared env & policy (no secrets committed)
- memory/ — read-only snapshots/indexes (published later by EOS)
- mcp/ — shared MCP manifests
- Claude Code CLI runs via scripts/claude-code-safe and stores local state in .claude (git-ignored)
- Codex CLI runs via scripts/codex-safe and can use .codex (git-ignored)
- playbooks/ — repo playbooks: standards, process, rules, EOS overview
- scripts/ — helper scripts (placeholders now)

See also:
- playbooks/README.md — start here for coding standards & process
- workspaces/ws-example/VERIFY_BEFORE_RUN.md — pre-run checklist
- workspaces/ws-example/DRY_RUN_CONFIG.md — how to validate compose config (no start)

## Compose files (do not run yet)
- Core wiring: eos/compose/core.podman.yml
- Runtime overlay: eos/compose/runtime.podman.yml (optional app/dev binds)

These files wire each agent’s config to /app/config/agent.yaml:ro and mount a
per-agent state volume at /app/data (agents store local state at /app/data/state.db).

### Canonical ports
| Service              | Port |
|----------------------|------|
| SESSION_LOG          | 3510 |
| CONFIGURATION        | 3511 |
| AUTH_SERVICE         | 3512 |
| SERVICE_REGISTRY     | 3515 |
| DB_AGGREGATOR        | 3516 |
| CONTEXT_AGGREGATOR   | 3517 |
| ROUTER               | 3434 |
| DASHBOARD            | 3000 |
| ORCHESTRATOR         | 3521 |
| EXEC                 | 3522 |

## Environment
Local secrets are loaded via config/env, which sources a single consolidated .env at the repo root (git-ignored).
Examples:
- .env values: OPENAI_API_KEY, ANTHROPIC_API_KEY, GH_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN, CODEX_API_KEY, defaults like OPENAI_MODEL/CLAUDE_MODEL

direnv support is prepared via config/.envrc if you choose to enable direnv later.

## First-run flow (high level, manual steps)
1. Review workspaces/ws-example/VERIFY_BEFORE_RUN.md and check every box.
2. Dry-run (when you’re ready) — see workspaces/ws-example/DRY_RUN_CONFIG.md for the exact podman-compose ... config command.
3. Only after dry-run looks correct, proceed to any install/start steps you choose (separate instructions).

## Notes
- Roles use flags ["S"] or ["S","C"] (don’t write SERVER/CLIENT).
- Tools (Claude/Codex) keep native memory in their home dirs; shared knowledge will be exported later into memory/ as read-only artifacts.

