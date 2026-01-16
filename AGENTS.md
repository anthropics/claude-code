# Repository Guidelines

## Project Structure & Module Organization
- `plugins/` contains Claude Code plugins. Each plugin has its own `README.md` and optional `commands/`, `agents/`, `skills/`, `hooks/`, `.claude-plugin/plugin.json`, and `.mcp.json`.
- `scripts/` holds Bun/TypeScript automation used by GitHub workflows in `.github/workflows/` (issue dedupe and triage).
- `examples/` includes sample hook implementations (see `examples/hooks/`).
- `.claude/commands/` defines repo-specific Claude Code commands used in automation.
- `.devcontainer/` and `Script/run_devcontainer_claude_code.ps1` support containerized development.
- Top-level docs: `README.md`, `CHANGELOG.md`, `SECURITY.md`, `LICENSE.md`.

## Build, Test, and Development Commands
- `bun run scripts/auto-close-duplicates.ts` runs duplicate-issue automation (requires `GITHUB_TOKEN`; optional `GITHUB_REPOSITORY_OWNER`, `GITHUB_REPOSITORY_NAME`, `STATSIG_API_KEY`).
- `bun run scripts/backfill-duplicate-comments.ts` backfills old duplicate comments (requires `GITHUB_TOKEN`; optional `DAYS_BACK`, `DRY_RUN=true|false`).
- Devcontainer: open with VS Code or run `Script/run_devcontainer_claude_code.ps1` on Windows to start the containerized environment.

## Coding Style & Naming Conventions
- Match the existing file style; keep changes minimal and readable.
- Indentation: 2 spaces in TypeScript and YAML workflows; 4 spaces in Python hooks.
- Naming: plugin folders and command files use kebab-case (`plugins/frontend-design/`, `commands/new-sdk-app.md`).
- Docs: prefer short paragraphs and explicit paths or commands.

## Testing Guidelines
- No repo-wide test suite is defined. Validate changes by running the relevant script or exercising the affected plugin or command locally.
- For workflow scripts, use `DRY_RUN=true` where available to avoid side effects.

## Commit & Pull Request Guidelines
- Commit history mostly follows Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`) with short, imperative subjects; align new commits with this pattern.
- If you add or change a plugin, update `plugins/README.md` and the plugin's own `README.md`; update `CHANGELOG.md` for user-facing changes.
- PRs should include a concise summary, testing or validation notes (even if "not run"), and links to any relevant issues.
