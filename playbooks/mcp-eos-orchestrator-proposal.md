# MCP Enhancements and EOS Orchestrator Integration (Proposal)

Status: draft
Owner: you + EOS expert
Scope: small, low‑risk MCP improvements that can later be orchestrated by an EOS agent

Goals
- Keep local tooling simple: single .env + config/env loader, wrappers under scripts/
- Improve discoverability and reliability of tools in MCP‑aware clients (VS Code, Copilot, Claude Code)
- Prepare a path for an EOS orchestrator agent to coordinate tools without changing their native behavior

Guiding principles
- OFTX (Observe → Formulate → Transact → Xfer)
- No secrets in MCP manifests; secrets only via .env loaded by config/env
- Cross‑platform and repo‑root portable (Linux, macOS, Windows via WSL/Git Bash)
- Minimal, additive JSON manifests; wrappers remain the execution boundary

Current state (baseline)
- Manifests
  - mcp/claude-code-cli.tool.json → scripts/claude-code-safe
  - mcp/codex-cli.tool.json → scripts/codex-safe
- Wrappers (bash)
  - scripts/claude-code-safe, scripts/claude-code-ws
  - scripts/codex-safe, scripts/codex-ws
  - scripts/with-repo-env, scripts/env-check
- Environment
  - Repo root .env (mode 600), loaded by config/env
  - VS Code project configured: MCP discovery on, Prettier on save, telemetry off, Warp external terminal (macOS)

Lightweight MCP enhancements (candidates)
1) Enrich command specs (metadata)
- Add descriptions, example usage, and arg schemas
- Ensure variadic args are clearly documented
- Include a version note in description (wrapper interface version)

2) Add convenience tools (aliases)
- codex-exec: explicit tool for non‑interactive prompts with model arg
  - command: scripts/codex-safe
  - args: model (string, optional; default from env), prompt (string, required)
  - behavior: runs `codex exec -m <model> <prompt>`
- claude-print: explicit tool for single‑turn printed response
  - command: scripts/claude-code-safe
  - args: prompt (string, required), model (string, optional; default from env)
  - behavior: runs `claude --print [...model] <prompt>`

3) Health/doctor tool
- mcp__health: quick readiness check that calls `scripts/env-check`
- Output is masked by design; no secrets printed

4) Policy surfaced as hints (non‑binding)
- Manifest description includes safety hints (read‑only default, allow overrides via CLI flags)
- Do not enforce approval/sandbox in manifests to avoid fighting tool defaults

5) Discovery & structure
- Keep manifests in mcp/*.json
- Keep all commands pointing to scripts/ wrappers (never binaries directly)

Security considerations
- No tokens in manifests; rely on .env + config/env loader
- Keep .env mode 600 and git‑ignored
- If CI needs secrets → use platform secrets (GitHub Actions secrets)

EOS orchestrator integration (future)
- Concept: an EOS agent coordinates tasks by calling MCP tools with OFTX discipline
- Observe: gather context (repo status, env‑check, tool versions)
- Formulate: plan steps using available MCP tools (codex‑exec, claude‑print, etc.)
- Transact: execute minimal, reversible steps; prefer dry‑runs where applicable
- Xfer: update docs (AGENT-ENV.md, playbooks/*), create structured commits
- Optional: single‑service compose dry‑runs for EOS agents (no automatic starts)

Cross‑platform notes
- Windows: use WSL/Git Bash for bash wrappers; PowerShell can set DEV_ROOT
- Keep wrapper behavior OS‑agnostic; environment via config/env

Proposed acceptance criteria (per enhancement)
- JSON lint passes
- Wrapper exists and is executable
- Tool runs in non‑interactive mode with sample prompt
- No secrets leak; masked output where relevant

Suggested initial tasks (when ready)
- Add codex-exec and claude-print manifests with arg schemas and examples
- Add mcp__health manifest pointing to scripts/env-check
- Add minimal examples section to docs/AGENT-ENV.md referencing these tools
- Validate from VS Code MCP discovery

Appendix A — example manifests (sketches)
- codex-exec.tool.json (sketch)
  {
    "name": "codex-exec",
    "description": "Run Codex non-interactively via scripts/codex-safe exec -m <model> <prompt> (wrapper v1)",
    "tools": [
      {
        "name": "exec",
        "type": "command",
        "command": "scripts/codex-safe",
        "args": [
          {"name": "model", "type": "string", "required": false, "description": "Model id (defaults from env)"},
          {"name": "prompt", "type": "string", "required": true, "description": "Prompt to run non-interactively"}
        ]
      }
    ]
  }
- claude-print.tool.json (sketch)
  {
    "name": "claude-print",
    "description": "Single-turn printed response via scripts/claude-code-safe --print (wrapper v1)",
    "tools": [
      {
        "name": "print",
        "type": "command",
        "command": "scripts/claude-code-safe",
        "args": [
          {"name": "prompt", "type": "string", "required": true},
          {"name": "model", "type": "string", "required": false}
        ]
      }
    ]
  }
- mcp__health.tool.json (sketch)
  {
    "name": "mcp-health",
    "description": "Repo readiness check (masked) via scripts/env-check (wrapper v1)",
    "tools": [
      {
        "name": "health",
        "type": "command",
        "command": "scripts/env-check"
      }
    ]
  }

Notes for EOS expert
- These are additive conveniences; they don’t change tool defaults
- Orchestrator logic should avoid enforcing policies that conflict with native tool behavior
- Prefer per-run flags for temporary restrictions (e.g., read-only) rather than hard-coding in manifests

