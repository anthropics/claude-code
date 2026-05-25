# Credential Guard

A Claude Code plugin that detects hardcoded credentials in file writes and blocks them before they reach disk or version control.

Addresses [#62095](https://github.com/anthropics/claude-code/issues/62095).

## Problem

When Claude Code writes files — especially in `bypassPermissions` mode or during routine execution — it may embed live credentials (API keys, tokens, passwords) directly in code or config files. These get committed to git and pushed to remotes, exposing secrets in version control history permanently.

## Quick Start

1. Install the plugin in your project:

```bash
claude /plugin install credential-guard
```

Or add to `.claude/settings.json`:

```json
{
  "plugins": ["credential-guard"]
}
```

2. That's it. The hook fires automatically before every file write. No configuration needed.

3. Try it out — ask Claude to write a file with a credential and watch it get blocked:

```
Write a config.ts that uses my GitHub PAT ghp_abc123...
```

## How It Works

```
┌──────────────────────────────────────────────────────┐
│  Claude wants to Write/Edit a file                   │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  PreToolUse hook fires                               │
│  → Extract content from tool input                   │
│  → Check if path is allowlisted                      │
│  → Scan content against 20+ credential patterns      │
│  → Apply context guards to reduce false positives    │
└──────────────┬──────────────────────┬────────────────┘
               │                      │
          No match                  Match found
               │                      │
               ▼                      ▼
┌──────────────────────┐  ┌────────────────────────────┐
│  exit(0) — proceed   │  │  exit(2) — BLOCK write     │
│                      │  │  Print warning + suggestion │
└──────────────────────┘  └────────────────────────────┘
```

## Detected Patterns

| Provider | Pattern | Example Prefix |
|----------|---------|----------------|
| GitHub | PATs, fine-grained PATs, OAuth, App tokens | `ghp_`, `github_pat_`, `gho_`, `ghu_`, `ghs_` |
| AWS | Access Key IDs, Secret Access Keys (context-guarded) | `AKIA` |
| Anthropic | API keys | `sk-ant-` |
| OpenAI | API keys, project keys | `sk-proj-` |
| Stripe | Secret and restricted keys | `sk_live_`, `sk_test_`, `rk_live_` |
| Slack | Bot/user tokens, webhook URLs | `xoxb-`, `xoxp-`, `hooks.slack.com` |
| Google/GCP | API keys, service account JSON | `AIza`, `"type": "service_account"` |
| Azure | Subscription keys (context-guarded) | 32 hex chars near Azure keywords |
| Twilio | API keys (context-guarded) | `SK` + 32 hex chars |
| SendGrid | API keys | `SG.` |
| Mailgun | API keys | `key-` |
| npm | Access tokens | `npm_` |
| PyPI | API tokens | `pypi-` |
| Heroku | API keys (context-guarded) | UUID format near Heroku keywords |
| Private Keys | PEM-encoded private keys (RSA, EC, DSA, Ed25519) | `-----BEGIN ... PRIVATE KEY-----` |
| Bearer/Basic | Hardcoded auth headers | `"Bearer ..."`, `"Basic ..."` |
| Database URLs | Connection strings with embedded passwords | `postgres://user:pass@`, `mongodb+srv://` |
| Generic | Variable assignments matching secret-like names | `api_key = "..."`, `token: "..."` |

### Context Guards

Overly broad patterns (AWS secret keys, Azure subscription keys, Heroku UUIDs, Twilio SIDs) use **context guards** — they only fire when surrounding text (200 chars) contains provider-specific keywords. This drastically reduces false positives on hex strings and UUIDs that appear in non-credential contexts.

## Intercepted Tools

| Tool | What's Scanned |
|------|---------------|
| **Write** | Full file content |
| **Edit** / **MultiEdit** | `new_string` content |
| **NotebookEdit** | New cell source |
| **Bash** | Commands containing `>`, `>>`, `tee`, or heredocs (`cat <<`) |

## Safe Paths (Allowlisted)

Files matching these patterns are **not** scanned, since they typically contain placeholder values:

| Pattern | Rationale |
|---------|-----------|
| `.env.example`, `.env.sample`, `.env.template` | Template files with placeholder values |
| `fixtures/`, `fixture/` | Test fixture data |
| `tests/*mock*`, `__test__/` | Mock/test files with fake credentials |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `CREDENTIAL_GUARD_DISABLED` | `0` | Set to `1` to disable the plugin entirely |

## Behavior on Detection

**First detection** — detailed warning with:
- File path
- Each credential found (redacted: first 4 chars + last 2, rest masked)
- Per-credential remediation suggestion (specific env var name)
- Write is **blocked** (exit code 2)

**Repeat attempts** (same secrets, same session) — shorter reminder, still blocked.

Warnings are deduplicated per session using state files in `~/.claude/` with automatic 30-day cleanup.

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

## Relationship to Other Plugins

- **security-guidance** — catches code-level vulnerabilities (XSS, injection, eval). Credential Guard catches secrets in data/config.
- **hookify** — lets users define custom hook rules. Credential Guard provides built-in, zero-config secret detection that works out of the box.

## Development

Run the test suite:

```bash
python3 plugins/credential-guard/tests/test_credential_guard.py -v
```

35 tests covering all pattern families, tool types, safe paths, clean content, the disable flag, and redaction.
