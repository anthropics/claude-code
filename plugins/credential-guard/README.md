# Credential Guard

A Claude Code plugin that detects hardcoded credentials in file writes and blocks them before they reach disk or version control.

Addresses [#62095](https://github.com/anthropics/claude-code/issues/62095).

## Why

When Claude Code writes files — especially in `bypassPermissions` mode or during routine execution — it may embed live credentials (API keys, tokens, passwords) directly in code or config files. These get committed to git and pushed to remotes, exposing secrets in version control history.

This plugin adds a `PreToolUse` hook that scans content **before** it is written, catches known credential patterns, and blocks the write with actionable remediation advice.

## Detected Patterns

| Provider | Pattern | Example |
|----------|---------|---------|
| GitHub | PATs, fine-grained PATs, OAuth, App tokens | `ghp_xxxx`, `github_pat_xxxx` |
| AWS | Access Key IDs, Secret Access Keys | `AKIAIOSFODNN7EXAMPLE` |
| Anthropic | API keys | `sk-ant-xxxx` |
| OpenAI | API keys, project keys | `sk-proj-xxxx` |
| Stripe | Secret and restricted keys | `sk_live_xxxx`, `rk_test_xxxx` |
| Slack | Bot/user tokens, webhook URLs | `xoxb-xxxx` |
| Google/GCP | API keys, service account JSON | `AIzaxxxx` |
| Twilio | API keys | `SK` + 32 hex chars |
| SendGrid | API keys | `SG.xxxx.xxxx` |
| Mailgun | API keys | `key-xxxx` |
| npm | Access tokens | `npm_xxxx` |
| PyPI | API tokens | `pypi-xxxx` |
| Private Keys | PEM-encoded private keys | `-----BEGIN RSA PRIVATE KEY-----` |
| Bearer/Basic | Hardcoded auth headers | `"Bearer eyJ..."` |
| Database URLs | Connection strings with passwords | `postgres://user:pass@host` |
| Generic | Assignment patterns (`secret = "..."`) | `api_key = "abc123..."` |

## Intercepted Tools

- **Write** — full file writes
- **Edit / MultiEdit** — partial file edits
- **Bash** — commands that redirect output to files (`>`, `>>`, `tee`, heredocs)

## Safe Paths (Allowlisted)

Files matching these patterns are **not** scanned, since they typically contain placeholder values:

- `.env.example`, `.env.sample`, `.env.template`
- `fixtures/`, `tests/*mock*`, `__test__/`

## Installation

Add the plugin to your project or user settings:

```json
{
  "plugins": ["credential-guard"]
}
```

Or install from the Claude Code plugin directory.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `CREDENTIAL_GUARD_DISABLED` | `0` | Set to `1` to disable the plugin entirely |

## How It Works

1. The hook runs before every `Write`, `Edit`, `MultiEdit`, or `Bash` tool call
2. Content is extracted and scanned against all credential patterns
3. Overly broad patterns (AWS secret keys, Azure keys, Heroku UUIDs) use **context guards** — they only fire if surrounding text contains provider-specific keywords
4. On first detection, a detailed warning is printed and the write is **blocked** (exit code 2)
5. Repeat attempts with the same secrets produce a shorter reminder and remain blocked
6. Warnings are deduplicated per session using state files in `~/.claude/`

## Example Output

```
================================================================
  CREDENTIAL GUARD — Hardcoded secret detected
================================================================

  File: src/config.ts

  [1] GitHub Personal Access Token
      Matched: ghp_****************************xy
      Fix:     Use $GH_TOKEN or $GITHUB_TOKEN environment variable

  This write has been BLOCKED to prevent credential exposure.
  Rewrite the code to use environment variables or a secrets
  manager, then retry.

  Docs: https://docs.claude.com/en/docs/claude-code/plugins
================================================================
```
