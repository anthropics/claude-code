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

## Adding a New Local Plugin

When adding a new plugin to `plugins/`, update **both** manifests or CI will fail:

1. **`directory.json`** (root) — the public marketplace manifest. Add an entry with `name`, `description`, `author`, `category`, and `"source": "./plugins/<name>"`.

2. **`.claude-plugin/marketplace.json`** — the bundled plugin registry. Add an entry with the same fields **plus** `version` and `author.email`. The "Validate plugin JSON" CI check enforces this.

Required `marketplace.json` entry shape:
```json
{
  "name": "plugin-name",
  "description": "...",
  "version": "1.0.0",
  "author": { "name": "...", "email": "..." },
  "source": "./plugins/plugin-name",
  "category": "development"
}
```

External plugins (git-subdir or URL source) go in `directory.json` only, with a pinned `sha`.
Guidance for Claude Code and other coding agents working in this repository.

## Security hardening for GitHub Actions

Workflow jobs in this repository that call Claude run with three protections.
Keep them when you add or edit a workflow.

1. **Egress-firewall runner.** The job has `runs-on: ubuntu-24.04-firewall`,
   a GitHub-hosted runner that filters the job's outbound network traffic. Do
   not move a job that calls Claude to another runner.
2. **Network allow list.** `.github/egress-firewall.yaml` lists the hosts
   those jobs may reach, besides any that GitHub's firewall allows by default.
   Keep `mode: enforce`, which is what makes the firewall block the rest. Follow
   that file's header when you add a host.
3. **Auto permission mode.** Every step that runs the Claude Code action
   (`uses: anthropics/claude-code-action`, or a local action with a
   `claude_args` input) passes `--permission-mode auto` in `claude_args`. A tool
   call that needs permission and that the allowed tools do not cover then runs
   only if Claude Code's safety review passes it. Allow only the tools the job
   needs, and keep any `--disallowedTools` list a step has. Use `claude-opus-4-6`
   or a newer model: on an older one Claude Code falls back to its default
   permission mode.

`claude.yml` answers `@claude` mentions. The Claude Code action sets
`--permission-mode acceptEdits` for those, and the `--permission-mode auto` in
the workflow's `claude_args`, which comes after it, replaces it.

`.github/workflows/workflow-hardening.yml` fails when a job that runs the Claude
Code action or mentions `ANTHROPIC_FEDERATION_RULE_ID` breaks protection 1 or 3,
or when the allow list is missing, empty, not `mode: enforce`, or names a host
with `*`. It cannot see a job that calls Claude another way, so check new
workflows by hand too. If a job cannot meet protection 1 or 3, add it with the
reason to the matching exemption table in
`.github/scripts/check_workflow_hardening.py`. A job in `EXEMPT_FROM_AUTO_MODE`
must set no permission mode at all. Do not skip or weaken the check.

Keep each workflow's `permissions:` block minimal, and never print tokens or
environment variables in workflow logs.
