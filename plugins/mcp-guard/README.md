# MCP Guard

MCP security hardening for Claude Code. This plugin closes the security gap between `claude mcp add` (which redacts secrets) and `claude mcp get` (which leaks them in plaintext), and helps you keep your MCP credentials safe.

## Why This Exists

A critical bug was reported in [issue #82351](https://github.com/anthropics/claude-code/issues/82351): `claude mcp add` correctly masks sensitive header values like `Authorization: Bearer <token>` in its output, but `claude mcp get` prints the full stored config including raw secrets in plaintext. This means a routine debug check can leak API keys, bearer tokens, and other credentials into your terminal scrollback and Claude Code session transcripts.

Until the CLI itself is patched, MCP Guard gives you defense in depth.

## What It Does

| Feature | Command | What It Protects |
|---------|---------|-----------------|
| Safe inspection | `/mcp-guard:inspect <server>` | View any MCP server config with secrets automatically redacted (replaces `claude mcp get` for security) |
| Security audit | `/mcp-guard:audit` | Scan all configured MCP servers for exposed secrets, plaintext credentials, and risky configs |
| Guided fix | `/mcp-guard:audit --fix` | Walk through remediating each finding step by step |
| Active hooks | Automatic | Warns when `claude mcp get` is run and detects plaintext secrets in MCP config files |

## Install

```
/plugin install mcp-guard
```

Or add to your `.claude/settings.json`:

```json
{
  "plugins": ["mcp-guard"]
}
```

## Prerequisites

- Claude Code CLI (any version)
- Python 3.8+ on `PATH` (`python3`, `python`, or `py -3`)

## Commands

### `/mcp-guard:inspect <server-name>`

Safely view an MCP server's configuration with automatic secret masking. Headers like `Authorization`, `X-API-Key`, `Token`, `Cookie`, and any values matching credential patterns (`Bearer`, `sk-...`, `ghp_...`, etc.) are replaced with `[REDACTED]`.

Use this instead of `claude mcp get` when you want to verify your config without leaking secrets into the terminal or session history.

```
/mcp-guard:inspect myserver
```

Output:
```
Server: myserver
  Transport: http
  URL: https://example.com/mcp
  Headers:
    Authorization: [REDACTED]
    X-Custom: visible-value (safe)
  Connection: ok
```

### `/mcp-guard:audit`

Run a full security scan across all your MCP configurations. Checks for:

- **CRITICAL**: Plaintext secrets in headers, URL-embedded credentials, hardcoded API keys
- **HIGH**: HTTP instead of HTTPS, localhost exposure, missing transport security
- **MEDIUM**: Config hygiene issues like missing timeouts, duplicate definitions

```
/mcp-guard:audit
```

### `/mcp-guard:audit --fix`

Same as audit, but guides you through fixing each issue. Creates the environment variables you need and helps update your config, with your explicit confirmation for each change.

## Hooks

MCP Guard installs two safety hooks that fire automatically:

1. **Bash hook**: When `claude mcp get` is detected in a Bash command, the hook checks your MCP configs for plaintext secrets and warns you if any would be exposed.

2. **File change hook**: When `.claude/mcp.json` is edited, the hook scans the new config for plaintext secrets and alerts you before they can leak.

Both hooks are fire-and-forget warnings - they never block your workflow, just keep you informed.

## How Redaction Works

The same patterns used by `claude mcp add` internally:

- **Header name matching**: `Authorization`, `X-API-Key`, `Api-Key`, `Token`, `Cookie`, `Set-Cookie`, `Secret`, `Credential`, and case-insensitive variants
- **Value pattern matching**: `Bearer <token>`, `Basic <credentials>`, `sk-*` (Anthropic keys), `ghp_*`/`gho_*` (GitHub tokens), and `key=*`/`token=*`/`secret=*` patterns
- **API key field**: The `apiKey` JSON field is always redacted
- **Env var detection**: Values using `${VAR}` or `$VAR` are recognized as safe and noted as such

## Privacy

MCP Guard runs entirely locally. Your MCP config is read from disk, scanned in memory, and the redacted output is displayed in your terminal. No data is sent anywhere, logged to disk, or transmitted over the network.

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `MCP_GUARD_DISABLE` | unset | Set to `1` to disable all MCP Guard hooks |
| `MCP_GUARD_DEBUG` | unset | Set to `1` for verbose hook output |

## Limitations

- MCP Guard cannot modify the behavior of `claude mcp get` itself - that requires a CLI patch. Use `/mcp-guard:inspect` as a safe alternative.
- The hook fires based on command matching (`claude mcp get` in bash), not on actual output inspection.
- Secret detection uses pattern matching, not semantic analysis. Some custom credential formats may not be recognized.

## The Problem This Solves

From the [issue report](https://github.com/anthropics/claude-code/issues/82351):

> `claude mcp add` redacts sensitive header values in its own confirmation output, but `claude mcp get <name>` does not apply the same masking - it prints the full stored config, including the raw secret value, in plaintext.

> Because `claude mcp get` is a natural, low-risk-looking command to run for a status/debug check, it's easy to end up with a live secret printed to a terminal and, when run inside an agent session, persisted into that session's transcript/history file on disk.

MCP Guard gives you a safety net until the CLI fix ships.

## Contributing

Found a bypass or a missing redaction pattern? Open an issue or PR. Security-related contributions are especially welcome.
