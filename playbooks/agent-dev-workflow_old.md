# Agent Dev Workflow — “close loop” with Claude, Codex, EOS

## Goal
Let builders (human + agents) iterate from anywhere using a shared monorepo plus EOS runtime. Keep tool memory local to tools; export only curated knowledge into `memory/` for cross-tool reuse.

## Working model
- **Monorepo** hosts EOS, workspaces, shared config, and MCP manifests.
- **Tool-native memory** stays with each tool (Claude, Codex). Do **not** force a shared write location.
- **Shared knowledge** is exported as **read-only** artifacts to `memory/indexes` and `memory/snapshots`.
- **EOS** aggregates per-agent deltas centrally (DB_AGGREGATOR) from per-agent local SQLite (`/app/data/state.db`).

## Day-to-day loop
1. **Pick a workspace** (e.g., `workspaces/ws-example/`) and add project rules in `CLAUDE.md`; keep repeatables under `.claude/commands/`.
2. **Environment** lives in `config/env` (git-ignored). Keep it minimal (model pins, keys).
3. **Dry-run first** with the compose config renders (see `repo-operations.md`).
4. **Single-service validation**: start just one core service with `--no-deps`, verify mounts/ports, then stop.
5. **Iterate**: agents edit inside the active repo/workspace; humans review diffs; commit small and often.
6. **Sync remote**: push to `main` or feature branch; use PRs for reviews and CI hooks.
7. **Export knowledge** (optional): write snapshots/summaries into `memory/` (read-only in runtime).

## MCP & integrations
- Manifests under `mcp/servers/` (GitHub, FS, HTTP). Keep tokens out of git.
- Tools discover MCP endpoints via their own configs; EOS prefers MCP-first wiring.

## Safety & guardrails
- Follow paste-safe rules (see `repo-operations.md`).
- No secrets in git; prefer `config/env` or platform secrets.
- Keep edits localized to the current workspace unless a task explicitly requires cross-cut changes.

## Growth path
- **Phase 1 (now):** per-agent SQLite + central DB_AGGREGATOR; read-only exports in `memory/`.
- **Phase 2:** dedicated **aggregator database** via CONTEXT_AGGREGATOR; exporters for tool memories.
- **Phase 3:** workspace-level routing via ROUTER & SERVICE_REGISTRY; move beyond Podman to orchestrator/Helm if needed.