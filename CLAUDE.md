# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

This is a fork of `anthropics/claude-code`, extended with:
- **`plugins/`** — Official Claude Code plugins (agents, skills, hooks, commands)
- **`source-build-australia/`** — A Next.js marketing/product site deployed via Netlify
- **`business-agent/`** — A managed-agent definition using the Claude Agent SDK
- **`examples/`** — GitHub automation scripts (issue lifecycle, label management, duplicate detection)
- **`scripts/`** — Shared GitHub CLI wrappers and utilities used by examples

The upstream docs (README, CHANGELOG, SECURITY, LICENSE) live at the root and are periodically synced from `anthropics:main`.

---

## Source-Build-Australia (Next.js App)

Located at `source-build-australia/`. This is the site deployed to Netlify (`publish = "source-build-australia/out"`).

```bash
cd source-build-australia
npm run dev      # Dev server on http://localhost:3000
npm run build    # Static export to out/
npm run start    # Serve the export locally
```

The app uses the Next.js App Router. Routes live under `app/` (e.g. `app/about/`, `app/products/`). Shared UI components are in `components/`. The AGENTS.md file at the root of this subdirectory contains Next.js-specific agent rules — read it before editing any Next.js code, as this version may have breaking changes from the canonical Next.js you know.

---

## Business Agent

Located at `business-agent/`. A Claude Agent SDK managed-agent that scans GitHub repositories for open issues and opens fix PRs.

- `business-agent.agent.yaml` — Agent definition (model, tools, skills, MCP servers)
- `business-agent.environment.yaml` — Runtime environment config
- `setup.sh` — One-time setup: creates agent and environment via `ant beta:agents/environments`, writes IDs to `.env`
- `run_agent.py` — Triggers a run against the created agent/environment
- `requirements.txt` — Python dependencies

To update the agent after editing the YAML:
```bash
ant beta:agents update --agent-id "$AGENT_ID" < business-agent.agent.yaml
```

---

## Plugins

Located at `plugins/`. Each subdirectory is a self-contained Claude Code plugin. The canonical plugin structure:

```
plugin-name/
├── .claude-plugin/plugin.json   # Required metadata
├── commands/                    # Slash commands (*.md files)
├── agents/                      # Agent definitions (*.md files)
├── skills/                      # SKILL.md files
├── hooks/                       # Hook scripts
├── .mcp.json                    # MCP server wiring (optional)
└── README.md
```

See `plugins/example-plugin/` for a reference implementation. All plugins listed in the root `directory.json` are part of the official Claude Code plugin marketplace — entries reference either local paths (`"source": "./plugins/..."`) or external git repos with pinned SHAs.

---

## Examples / Scripts

`examples/` contains GitHub automation tools run as one-off scripts or GitHub Actions:
- `issue-lifecycle.ts` / `lifecycle-comment.ts` — Auto-comment and close stale issues
- `auto-close-duplicates.ts` — Detect and close duplicate issues
- `backfill-duplicate-comments.ts` — Retroactively comment on duplicates
- `gh.sh` — Restricted `gh` CLI wrapper (allow-listed subcommands only)
- `sweep.ts` / `edit-issue-labels.sh` — Bulk label management

`scripts/` contains the shared `gh.sh` wrapper and other utilities referenced by both `examples/` and GitHub Actions.

---

## Directory Manifest

`directory.json` is the root marketplace manifest (`$schema: anthropic.com/claude-code/marketplace.schema.json`). Each entry has `name`, `description`, `author`, `category`, and `source`. Local plugins use `"source": "./plugins/<name>"`. External plugins use a git-subdir or URL source with a pinned `sha`.

When adding a new local plugin, add a corresponding entry to `directory.json`.
