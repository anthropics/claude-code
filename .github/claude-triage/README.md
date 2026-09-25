# claude-code-triage

Automated issue triage and weekly digest for `anthropics/claude-code`, powered by Claude.

## What it does

**Issue triage** (`issues.opened` trigger):
- Applies labels from Anthropic's taxonomy (area, type, platform, API, priority)
- Posts a structured triage comment with summary and reasoning
- Detects potential duplicate issues
- Flags issues that need more information

**Weekly digest** (Monday 9am UTC + `workflow_dispatch`):
- Summarizes the past 7 days of issues and PRs
- Highlights P0/P1 issues needing attention
- Creates a new digest issue and closes the previous one

## Cost

| Operation | Model | Est. cost |
|-----------|-------|-----------|
| Per issue triage | Haiku 4.5 | ~$0.001 |
| Weekly digest | Sonnet 4.6 | ~$0.05 |
| **Monthly total** (50 issues/wk) | | **~$0.25** |

## Setup

1. Add `ANTHROPIC_API_KEY` to your repository secrets
2. Copy this directory to `.github/claude-triage/` in your repo
3. Copy the workflow files to `.github/workflows/`

The workflows use `secrets.GITHUB_TOKEN` (auto-provided by Actions) for GitHub operations — no additional GitHub token required.

## Configuration

Override defaults via environment variables in the workflow:

| Variable | Default | Description |
|----------|---------|-------------|
| `TRIAGE_MODEL` | `claude-haiku-4-5-20251001` | Model for per-issue triage |
| `DIGEST_MODEL` | `claude-sonnet-4-6` | Model for weekly digest |
| `ANTHROPIC_BASE_URL` | _(Anthropic default)_ | Override for compatible endpoints |
| `DIGEST_DAYS` | `7` | Days to include in digest |

## Design principles

- **Labels are suggestions only** — maintainers retain full control, bot adds labels additively
- **No destructive permissions** — `issues: write` only (label, comment, create/close issues)
- **Bot-skip guard** — `if: github.actor != 'github-actions[bot]'` prevents infinite loops
- **Endpoint-agnostic** — `ANTHROPIC_BASE_URL` swap enables alternative providers
- **Zero build step** — `tsx` runs TypeScript directly in CI, no compiled artifacts

## Local development

```bash
pnpm install

# Triage a specific issue (read-only token will fail on write ops but validates fetch + LLM)
ISSUE_NUMBER=27790 GITHUB_TOKEN=<token> ANTHROPIC_API_KEY=<key> pnpm triage

# Generate digest
GITHUB_TOKEN=<token> ANTHROPIC_API_KEY=<key> pnpm digest

# Typecheck
pnpm typecheck

# Test Kimi endpoint compatibility
ANTHROPIC_BASE_URL=https://api.kimi.com/coding/ ANTHROPIC_API_KEY=<kimi-key> ISSUE_NUMBER=27790 GITHUB_TOKEN=<token> pnpm triage
```

## Architecture

```
src/
├── github.ts    # Octokit helpers: fetch, label, comment, search
├── llm.ts       # Anthropic SDK wrapper with base URL override
├── prompts.ts   # Label taxonomy, prompt builders, TriageResult type
├── triage.ts    # Entry point: ISSUE_NUMBER → labels + comment
└── digest.ts    # Entry point: past N days → weekly digest issue
```

Inspired by [`duanyytop/agents-radar`](https://github.com/duanyytop/agents-radar), which independently triage'd claude-code issue #27790 as P1 — more precisely than the affected users themselves.
