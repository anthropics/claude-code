# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Context and scope
- Tool-agnostic monorepo with a Podman-first EOS runtime. Do not start containers by default; prefer dry-runs. macOS rootless environment assumed.
- DEV_ROOT is expected to be /Users/user/dev. Path checks use $DEV_ROOT at repo root; do not look under eos/ for workspaces/config.

Common terminal commands
- Dry-run compose rendering (no start)
  - podman-compose -f eos/compose/core.podman.yml config
  - podman-compose -f eos/compose/core.podman.yml -f eos/compose/runtime.podman.yml config
- Podman readiness (macOS rootless)
  - podman --version
  - podman machine ls  (avoid template formats on 5.6.x)
  - If needed later: podman machine start
- Inventory and cleanup (no start)
  - podman ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  - podman ps -a | grep '^eos-'
  - If eos-configuration exists: podman stop eos-configuration; podman rm -f eos-configuration
- Single-service verification pattern (do not include a full up by default)
  - podman-compose -f eos/compose/core.podman.yml up -d --no-deps configuration
  - podman inspect eos-configuration | grep -E '/app/config/agent.yaml|/app/data'
  - podman port eos-configuration
  - podman-compose -f eos/compose/core.podman.yml rm -sf configuration
- Helper script (prints intended compose commands only)
  - scripts/check-compose.sh [repo_root]

Architecture and layout (big picture)
- Two compose files:
  - Core: eos/compose/core.podman.yml
  - Optional dev overlay: eos/compose/runtime.podman.yml (adds an app service and local binds)
- Canonical host ports per agent:
  - SESSION_LOG 3510; CONFIGURATION 3511; AUTH_SERVICE 3512; SERVICE_REGISTRY 3515; DB_AGGREGATOR 3516; CONTEXT_AGGREGATOR 3517; ROUTER 3434; DASHBOARD 3000; ORCHESTRATOR 3521; EXEC 3522
- Standard mounts:
  - Config file bound read-only to /app/config/agent.yaml
  - Named volume at /app/data containing state.db
- Runtime overlay bindings:
  - Exposes app on 8080
  - workspaces/ws-example → /workspace (rw)
  - memory/snapshots → /opt/knowledge/snapshots (ro)
  - memory/indexes → /opt/knowledge/indexes (ro)
  - Loads env from config/env
- Repo essentials:
  - eos/ (compose and agents), workspaces/, config/, memory/, mcp/, playbooks/, scripts/
  - Path correction: reference $DEV_ROOT/workspaces/ws-example and $DEV_ROOT/config at the repo root (not under eos/)

Rules and operating notes
- Paste-safe terminals/agents:
  - No bash -lc wrapping
  - Avoid heredocs; if strictly needed, use the single-quoted heredoc delimiter (double-less-than with a quoted tag)
  - Disable pagers/prompts; run one step at a time; if quote> / heredoc> appears, press Ctrl-C
- Process flow: verify checklist → dry-run → only then consider start
- Keep edits scoped to the active workspace (workspaces/ws-example) unless a task says otherwise; prefer structured commands
- Podman 5.6.x: podman machine ls must be plain (no format templates)
- Always use the GitHub MCP for GitHub operations; prefer MCP over ad-hoc gh CLI tokens
- MCP manifests live under mcp/
- Secrets/env: single consolidated .env at repo root (git-ignored). Source via config/env, which loads .env; per-tool env.d is deprecated.
- Tool homes (repo-local, git-ignored): .claude for Claude Code, .codex for Codex; use wrappers under scripts/

GitHub operations (MCP-only)
- Do not run git pushes or GitHub operations directly from the terminal over HTTPS.
- Use your MCP-enabled client (e.g., VS Code with MCP) to push branches and open PRs.
- If a branch is prepared locally (e.g., chore/env-mcp-docs-unify), push it via MCP so authentication is handled by your MCP client.
- Avoid configuring ad-hoc tokens or changing remotes to bypass MCP policy. If a terminal push is absolutely required, explicitly document the exception and revert to MCP flows immediately after.

Tooling status
- Repo root has no build/lint/test toolchain (no package.json, pyproject.toml, Makefile)
- Test/build commands are N/A here; use per-agent/app repositories for language-specific tasks

