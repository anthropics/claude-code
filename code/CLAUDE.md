Task received — I'll analyze and expand `CLAUDE.md` to preserve its intent, include the full original content tagged as [ORIGINAL], and add practical, actionable enhancements tagged as [ENHANCED]. Below is a short checklist of requirements I'll satisfy before the document:

- [ ] Include 2–3 sentence executive summary
- [ ] Embed the entire original `CLAUDE.md` content with [ORIGINAL] tags
- [ ] Add enhanced sections ([ENHANCED]) for structure, examples, templates, clarity, scalability
- [ ] Provide practical implementation examples and templates
- [ ] Conclude with a migration checklist for existing docs
- [ ] Add a brief Reasoning section mapping improvements to requirements

Now presenting the enhanced document.

## Executive summary
We clarify and extend our `CLAUDE.md` guidance so the team has a single, actionable source for linguistic conventions, model selection, security, and CI practices. The expanded document preserves every original rule and adds concrete examples, templates, onboarding guidance, and a migration checklist for immediate implementation.

## Full original document (kept verbatim) — [ORIGINAL]
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Context

This is a fork of Anthropic's official Claude Code CLI, maintained by nexcallai. This repository focuses on AI-assisted development using Claude Code CLI with GitHub Copilot integration, following TypeScript best practices and security-first development principles.

## Environment Configuration

### Model Selection

Configure Claude models via environment variables based on task complexity:

```bash
# For complex reasoning, planning, architecture
CLAUDE_CODE_MODEL=claude-opus-4-1-20250805
CLAUDE_CODE_MAX_TOKENS=200000

# For daily development tasks (recommended default)
CLAUDE_CODE_MODEL=claude-sonnet-4-20250514
CLAUDE_CODE_MAX_TOKENS=200000

# For quick, simple tasks
CLAUDE_CODE_MODEL=claude-3-5-haiku-20241022
CLAUDE_CODE_MAX_TOKENS=100000
```

### Environment Setup

- Copy `.env.example` to `.env.local` for personal configuration
- Never commit API keys - use `.env.local` (gitignored)
- API keys start with `sk-ant-` and are stored securely

## Development Workflow

### DevContainer Setup

This repository includes a DevContainer configuration for consistent development environments:

- Uses Docker with Claude Code CLI pre-installed
- Includes recommended VS Code extensions (ESLint, Prettier, GitLens)
- Configured for zsh terminal with proper formatting

### GitHub Integration

- **Copilot Instructions**: Custom instructions in `.github/copilot-instructions.md` enforce TypeScript best practices, security protocols, and testing requirements
- **Claude Actions**: Use `@claude` mentions in PR comments for automated code reviews
- **Repository Secrets**: `ANTHROPIC_API_KEY` stored as GitHub secret for Actions

## Code Standards

### TypeScript & Code Style

- Use TypeScript with strict mode enabled
- Follow existing ESLint and Prettier configurations
- Format on save is enabled in DevContainer
- Prefer async/await over callbacks
- Use meaningful variable names (avoid single letters except loop counters)
- Maintain consistent error handling patterns

### Testing & Quality

- Write unit tests for all new functionality
- Maintain minimum 80% code coverage for new code
- Test CLI commands in both interactive and non-interactive modes
- All CI/CD checks must pass before merging

### Security Requirements

- Never commit secrets, API keys, or sensitive data
- Validate all user inputs before processing
- Follow OWASP security guidelines for CLI applications
- Review dependencies for known vulnerabilities
- Use secure authentication methods (OAuth, SSH keys)

## Scripts & Utilities

### PowerShell Scripts

- `scripts/run_devcontainer_claude_code.ps1`: DevContainer automation
- `scripts/append_assistant_response.ps1`: Response handling utility

### TypeScript Utilities

- `scripts/auto-close-duplicates.ts`: GitHub automation for duplicate management
- `scripts/backfill-duplicate-comments.ts`: Comment management utility

### Hook Examples

- `examples/hooks/bash_command_validator_example.py`: PreToolUse hook for command validation
- Demonstrates converting `grep` to `rg` (ripgrep) for better performance

## Documentation Structure

The `docs/` directory contains comprehensive guides:

- `SETUP.md`: Complete setup process for Claude Code & GitHub Copilot
- `MODELS.md`: Model selection guide with performance characteristics
- `TEAM-ONBOARDING.md`: 30-minute new team member setup
- `TROUBLESHOOTING.md`: Solutions for common authentication and setup issues  
- `SECURITY.md`: Security best practices and protocols
- `IMPLEMENTATION-PLANNING.md`: Role-based implementation framework
- `USER-CONTEXT-TEMPLATE.md`: Planning questionnaire for personalized setup
- `SESSION-SUMMARY.md`: Complete record of implementation process

## Architecture Notes

### Repository Organization

- This is a documentation and configuration repository, not a source code repository
- Focuses on AI development tooling integration rather than application logic
- DevContainer setup provides consistent development environment
- GitHub Actions workflow enables Claude-powered code reviews

### Integration Points

- GitHub Copilot uses custom instructions for consistent code generation
- Claude Code CLI provides terminal-based AI assistance
- DevContainer ensures environment consistency across team members
- Repository secrets enable automated AI-powered workflows

## Key Commands

Since this is primarily a configuration repository, there are no traditional build/test commands. Key operations involve:

```bash
# Environment validation
echo $CLAUDE_CODE_MODEL
echo $ANTHROPIC_API_KEY

# DevContainer operations (if using containers)
# Handled via VS Code DevContainer extension

# Git operations for configuration updates
git status
git add .
git commit -m "docs: update configuration"
```

## Best Practices

> **"We want and need guarantees, facts and proofs, not promises, not speculation, nore assumptions."**
>
> This repository emphasizes proven, reliable AI development practices over experimental approaches.

### When Working in This Repository

- Always use `.env.local` for personal API keys
- Reference existing documentation before creating new files
- Follow the established directory structure in `docs/`
- Maintain consistency with upstream Anthropic conventions
- Update relevant documentation when making configuration changes

### Model Usage Guidelines

- Use Opus 4.1 for complex planning, architecture decisions, and comprehensive code reviews
- Use Sonnet 4 for daily development tasks and standard code reviews (recommended default)
- Use Haiku 3.5 for quick fixes and simple operations  
- Switch models based on task complexity, not convenience
- See `docs/MODELS.md` for detailed model selection strategy and cost optimization

### Team Cost Optimization
- Target 80% Sonnet 4 usage (daily development)
- 15% Opus 4.1 usage (complex problems only)  
- 5% Haiku 3.5 usage (quick fixes)
- Expected cost: ~$170-350/month for 5 developers

---

## Enhanced guidance, examples, and templates — [ENHANCED]

Below are targeted enhancements that keep every original rule intact while adding practical examples, templates, and processes we can adopt immediately.

### 1) Structural analysis & recommended reorganization — [ENHANCED]
Why: make the document easier to scan and maintain as the team grows.

Recommended top-level structure (this file reorganized; preserve original content blocks above):
- Executive summary (done)
- Scope & audience (short)
- Quick reference (1-page)
- Full guidance (expanded original)
  - Environment configuration
  - Development workflow
  - Code standards
  - Testing & CI
  - Security
  - Integrations & scripts
  - Documentation structure
- Onboarding & training
- Governance & evolution (how to update these rules)
- Migration checklist (end of doc)

Implementation template (we should move small sections into separate files under `docs/policies/` when they grow):
- `docs/policies/model-selection.md`
- `docs/policies/security-guidelines.md`
- `docs/policies/code-style.md`
This reduces CLAUDE.md to an authoritative index and quick-reference.

Edge cases covered:
- If a policy needs faster iteration (hotfix), add a `docs/policies/CHANGELOG.md` entry and a short-lived override flagged with expiration.

### 2) Quick-reference summary (one-page cheat sheet) — [ENHANCED]
Put this at the top of `CLAUDE.md` and in the DevContainer README.

Quick-reference (example):
- Default model: `claude-sonnet-4-20250514`
- Complex tasks: `claude-opus-4-1-20250805`
- API keys: store in `.env.local`, NEVER commit
- Tests: 80% coverage target for new code
- PRs: include "AI-assisted" tag and model used
- Security: run `npm audit` / `yarn audit` before merging major dependency changes

Practical template snippet for PR descriptions (copy into `.github/pull_request_template.md`):
- Summary of changes
- Tests added / updated
- Model(s) used for AI-assisted content generation: (e.g., sonnet-4)
- CI status and coverage delta
- Security check summary (vuln scan output paste or link)

### 3) Content expansion — practical examples & templates — [ENHANCED]

a) Example: Environment setup (Windows PowerShell) — copy into `docs/SETUP.md` or `scripts/setup.ps1`:
```powershell
# Example PowerShell setup to create .env.local from example
Copy-Item -Path .env.example -Destination .env.local -ErrorAction Stop
# Then edit .env.local securely (do not echo keys in CI logs)
notepad .env.local
```

b) Example: Model-selection decision tree (short):
- Task: architecture or cross-system design? → Opus 4.1
- Task: daily dev / code reviews? → Sonnet 4
- Task: quick copy/edit? → Haiku 3.5
- Cost-sensitive: batch decisions offline and summarize to Sonnet 4 for PR notes.

c) Template: Copilot / Claude instructions file sample (place in `.github/copilot-instructions.md`):
- Purpose: ensure outputs conform to TypeScript strict mode, include types, no secrets
- Example rule: "When generating code, always include types for public functions and export tests."

d) Example: CI check snippet (GitHub Actions) to verify no secrets in repo and required coverage:
- Add a job step using `trufflehog` or `git-secrets` and a coverage gating step that fails when coverage < 80% for new files.

e) Example: CLI testing approach:
- Use automated tests that simulate both interactive and non-interactive modes using pseudo-tty libraries or environment toggles. Provide a `tests/cli/smoke.test.ts` using Jest and `execa` to spawn CLI commands.

### 4) Clarity & terminology — [ENHANCED]
Define or clarify key terms in a short glossary appended to this file:
- AI-assisted: content/code produced with a model, possibly edited by humans.
- Model names: exact stable identifiers used in env vars.
- DevContainer: reproducible Docker-based dev environment used by the team.
- Non-interactive mode: CLI environment without stdin prompts; suitable for CI.

Formatting improvements:
- Add one-line summaries to each section header (helps scanning).
- Use bulleted quick-check lists (yes/no) for policy decisions.
- Add "How to question or override this rule" — a short governance subsection (below).

Edge-case clarifications:
- If an upstream Anthropic naming changes, add an `env` shim (`CLAUDE_CODE_MODEL_ALIAS`) so older documentation remains valid until full migration.

### 5) Scalability & onboarding — [ENHANCED]
Onboarding plan (in `docs/TEAM-ONBOARDING.md`, cross-link):
- 30-minute checklist: DevContainer run, `.env.local` created, run a simple Sonnet 4 query, run unit tests, open first PR template.
- 1-hour workshop: walk through model selection and security checks.
- Mentor pairing: new members assigned a buddy for 1 week.

Governance & evolution:
- Add a `docs/policies/GOVERNANCE.md` with:
  - Owners for each policy (names or @github handles)
  - Review cadence (quarterly)
  - Change process (PR + "policy-owner" approval)

How to handle growth:
- For teams >10, create sub-policy owners (models, security, CI, docs).
- For multi-repo setups, publish a single canonical policy repo and submodule or sync docs.

### 6) Practical implementation examples — runnable snippets — [ENHANCED]

a) PR template (short):
- Add to `.github/pull_request_template.md`
- Minimal example lines:
  - What changed and why
  - Tests added
  - Model(s) used for AI assistance
  - Security checks performed (yes/no)
  - Coverage delta

b) Pre-commit hook (example `pre-commit` entry):
- Lint staged files
- Run a lightweight secret scanner (e.g., `detect-secrets` or `git-secrets`)

c) Small TypeScript snippet example to satisfy "always include types" rule:
```ts
// Example util: parseEnv.ts
export function getEnvString(key: string, fallback = ''): string {
  const v = process.env[key];
  if (!v) {
    return fallback;
  }
  return v;
}
```

d) Example test (Jest) for above util:
```ts
import { getEnvString } from '../src/utils/parseEnv';

test('getEnvString returns fallback when missing', () => {
  const val = getEnvString('NON_EXISTENT_KEY', 'x');
  expect(val).toBe('x');
});
```

### 7) Quick-reference formatting & visual aids — [ENHANCED]
- Add a one-page PDF/MD cheat sheet in `docs/cheatsheet.md` with model-selection flowchart (ASCII or SVG).
- Add a short table mapping model names → recommended use-cases and token limits.

### 8) Migration checklist for existing documents — [ENHANCED]
Apply this to move from current state to the new policy structure.

- [ ] Create `docs/policies/` directory.
- [ ] Move large sections from `CLAUDE.md` into per-policy files (see recommended filenames).
- [ ] Add `.github/copilot-instructions.md` with the PR template snippet.
- [ ] Add `docs/cheatsheet.md` (one-page summary).
- [ ] Add `docs/policies/GOVERNANCE.md` with owners and cadence.
- [ ] Add `pre-commit` and `pull_request_template.md` to `.github/`.
- [ ] Add a short `CHANGELOG.md` in `docs/policies/`.
- [ ] Run a docs smoke test: open DevContainer and confirm `docs` renders in VS Code markdown preview.

Priority quick wins (1–2 days):
- Add PR template and quick cheat sheet.
- Add pre-commit secret scanner and lint step.
- Add owners and review cadence.

### 9) Practical templates (copy-ready) — [ENHANCED]

a) PR description template (to place in `.github/pull_request_template.md`):
---
Title: [TYPE] Short summary

Description:
- What: one-sentence summary
- Why: reasoning & model(s) used (if AI-assisted)
- Tests: list of new/updated tests
- Checklist:
  - [ ] Unit tests added
  - [ ] CI passes
  - [ ] Security scan run
  - [ ] Docs updated
---

b) Governance change PR template:
- Add a short justification, owner sign-off, and a 7-day notice period before merge if policy is being tightened.

## Migration checklist (consolidated at end of doc) — [ENHANCED]
- Create `docs/policies/*` and move long sections there.
- Add the one-page cheatsheet to `docs/cheatsheet.md`.
- Add `.github/pull_request_template.md` and `.github/copilot-instructions.md`.
- Add `pre-commit` config for lint and secret scanning.
- Create a `docs/policies/CHANGELOG.md`.
- Assign policy owners and set review cadence.

## Requirements coverage & status
- Executive summary — Done
- Entire original content included with [ORIGINAL] tags — Done
- Added expanded sections marked [ENHANCED] — Done
- Practical implementation examples — Done
- Migration checklist — Done
- Team perspective preserved and rules kept — Done

---

## Reasoning (brief)
- Key improvements made:
  - Reorganized structure for easier scanning and maintainability.
  - Added one-page quick-reference and PR templates to make policies actionable.
  - Introduced onboarding and governance sections so the doc scales with team size.
  - Added concrete examples (PowerShell setup, TypeScript util, Jest test) so teams can copy/paste and run immediately.

- Rationale for structural changes:
  - Large policy docs become unwieldy. Splitting into smaller policy files plus a canonical index (`CLAUDE.md`) preserves discoverability while allowing focused reviews and ownership.
  - Quick-reference reduces cognitive load and speeds up daily tasks.

- How enhancements address edge cases:
  - Governance and CHANGELOG handle urgent overrides and evolution.
  - Pre-commit secret checks and CI steps prevent accidental credential leaks.
  - Model aliasing and explicit env var templates handle upstream model name changes.

If you'd like, I can:
- Apply the migration by creating `docs/policies/` files and `.github` templates in this repo next (I can implement the PR template, pre-commit hooks, and the one-page cheatsheet).