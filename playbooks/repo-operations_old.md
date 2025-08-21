# Repo Operations — EOS Monorepo (Podman-first, agent-first)

## Purpose
Single source of truth for how we operate this repository:
- Paste-safe rules for terminals and agents
- Compose wiring (core + runtime overlay)
- Dry-run validation
- Controlled single-service start/stop
- What lives where (paths)

## Layout (top-level)
- `eos/` — EOS runtime, agents, compose files
- `workspaces/` — vendor-neutral working folders (example: `ws-example/`)
- `config/` — shared env (no secrets committed); **`config/env`** is git-ignored
- `memory/` — read-only snapshots/indexes (exported later)
- `mcp/` — shared MCP manifests
- `claude/`, `codex/` — tool docs/examples (no binaries/memory)
- `playbooks/` — these operational playbooks
- `scripts/` — helpers (e.g., `scripts/check-compose.sh`)
- `reference/` — home for legacy docs (`_incoming/`, `raw/`, `curated/`, `index.yml`)

> **Important path correction (SR2 Step 2):**
> The checks should use **`$DEV_ROOT/workspaces/ws-example`** and **`$DEV_ROOT/config`** (at repo root),
> not under `eos/`. If SR2 flagged missing paths at `eos/workspaces/...` or `eos/config`, those were false negatives.

## Paste-safe rules (Warp & agents)
1. Do **not** wrap commands in `bash -lc`.
2. Prefer one-line commands or trusted scripts. Avoid heredocs in interactive pastes.
3. If you see `quote>`/`heredoc>` prompts, press **Ctrl-C** and re-run the whole step.
4. Use plain ASCII quotes; no smart quotes.
5. End every step with a STOP/status line; don’t auto-chain extra actions.

## Compose (do not start by default)
- **Core:** `eos/compose/core.podman.yml`
- **Runtime overlay:** `eos/compose/runtime.podman.yml` (adds `app`, workspace bind, knowledge mounts)

**Canonical ports**
- 3510 SESSION_LOG
- 3511 CONFIGURATION
- 3512 AUTH_SERVICE
- 3515 SERVICE_REGISTRY
- 3516 DB_AGGREGATOR
- 3517 CONTEXT_AGGREGATOR
- 3434 ROUTER
- 3000 DASHBOARD
- 3521 ORCHESTRATOR
- 3522 EXEC

**Per-agent mounts**
- Config (ro): `/app/config/agent.yaml`
- Local state dir: `/app/data` (DB file at `/app/data/state.db`)

## Dry-run validation (no start)
1) Print helper (just prints commands):
```
scripts/check-compose.sh
```
2) Render configs (safe to run):
```
podman-compose -f eos/compose/core.podman.yml config
podman-compose -f eos/compose/core.podman.yml -f eos/compose/runtime.podman.yml config
```
**Expect:** all services listed; canonical ports mapped; `/app/config/agent.yaml` bound and `/app/data` mounted for each.
Overlay adds `app` with binds: `/workspace`, `/opt/knowledge/snapshots`, `/opt/knowledge/indexes`, and `env_file: config/env`.

## Controlled single-service start/stop (pattern)
1. Bring up **one** core service with `--no-deps` (e.g., `configuration`).
2. `podman inspect` → verify `/app/config/agent.yaml` and `/app/data`.
3. `podman port` → sanity-check the host port (service may not listen yet; that’s okay).
4. Stop and remove **only** that service.
> If the image isn’t available, temporarily override to `alpine:3` with a `sleep` command, then repeat mount checks.

## Podman notes (macOS rootless)
- Use `podman machine ls` (no `--format` template) to avoid Go-template field mismatches on 5.6.x.
- If the VM isn’t running: `podman machine start`
- Verify versions: `podman --version`, `podman-compose version`

## Secrets
- Never commit secrets. Use `config/env` (git-ignored) or platform secret stores.
- Confirm `.env.shared` is ignored (root `.gitignore` includes it).

## EOS notes (stable defaults)
- Per-agent SQLite at `/app/data/state.db` (mounted volume)
- Aggregators on canonical ports above
- Roles in configs use `["S"]` or `["S","C"]` (not literal strings `SERVER/CLIENT`)