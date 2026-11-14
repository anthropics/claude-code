---
description: Scan all MCP server configs for security issues, exposed secrets, and misconfigurations
allowed-tools: ["Read", "Grep", "Glob", "Bash", "Write", "Edit"]
argument-hint: Optional --fix flag to auto-remediate findings
---

# MCP Config Security Audit

Scan all your configured MCP servers for security issues including exposed secrets, plaintext credentials, and risky configurations. Every finding includes a severity rating and a concrete fix suggestion.

## Usage

```
/mcp-guard:audit
/mcp-guard:audit --fix
```

With `--fix`, the plugin will help you remediate findings by suggesting safer alternatives.

## What It Checks

### Secret Exposure (Severity: CRITICAL)
Scans all MCP server configs for secrets stored in places they could leak:

- **Headers with secret values**: Authorization, API-Key, Token, Cookie headers that contain bearer tokens, API keys, or credentials in plaintext
- **URL-embedded credentials**: URLs containing `user:password@host` patterns
- **Config-level secrets**: The `apiKey` field or similar fields with literal secret values
- **Environment variable references**: Flags values that ARE properly using env vars (these are safe and noted as such)

Reports which servers are affected and whether the secret would be exposed by `claude mcp get`.

### Transport Security (Severity: HIGH)
Checks for transport-level security concerns:

- **HTTP vs HTTPS**: Warns if any transport URLs use plain HTTP
- **Localhost exposure**: Flags MCP servers bound to `0.0.0.0` instead of `127.0.0.1`
- **SSE endpoints**: Verifies SSE endpoints use secure connections

### Config Hygiene (Severity: MEDIUM)
Checks for configuration issues:

- **Deprecated fields**: Flags any deprecated config patterns
- **Missing timeouts**: Warns if timeout values are not set
- **Duplicate servers**: Detects servers defined in both global and project configs

## Audit Report Format

```
MCP Security Audit Report
=========================
Generated: now
Scope: all configured servers

CRITICAL: Secret Exposure
  Server: myserver (Authorization header contains Bearer token)
    Risk: Plaintext secret would be leaked by `claude mcp get`
    Fix: Move the token to an environment variable:
         export MYSERVER_TOKEN="sk-..."
         Then update config: --header "Authorization: Bearer ${MYSERVER_TOKEN}"

  Server: legacy-api (URL contains embedded credentials)
    Risk: Password in URL could appear in logs and process listings
    Fix: Use environment variables: https://${API_USER}:${API_PASS}@host/api

HIGH: Transport Security
  Server: internal-tools (uses http:// instead of https://)
    Risk: Traffic is unencrypted
    Fix: Change to https:// or use stdio transport for local-only tools

MEDIUM: Config Hygiene
  Server: all-good (properly configured)
    Status: No issues found - secrets use environment variables

Summary: 2 CRITICAL, 1 HIGH, 0 MEDIUM
Recommendation: Fix CRITICAL items first - use /mcp-guard:fix for guided remediation
```

## Remediation with --fix

When run with `--fix`, the plugin guides you through fixing each finding:

1. For exposed secrets: Shows the env var to create and helps update the config
2. For HTTP endpoints: Suggests the HTTPS equivalent
3. For config issues: Shows the exact edit needed

The plugin never makes changes without your explicit confirmation.

## When To Run

- After setting up new MCP servers
- Before sharing your screen or session recordings
- As part of your onboarding checklist for new team members using Claude Code
- Periodically as a security best practice

## Notes

- This command is READ-ONLY unless you pass `--fix`
- The audit respects existing environment variable usage - those are marked as safe
- Config is read from both global (`~/.claude/mcp.json`) and project (`.claude/mcp.json`) locations
