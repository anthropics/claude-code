---
description: Safely inspect MCP server configurations with automatic secret masking and sensitive header redaction
allowed-tools: ["Read", "Grep", "Glob", "Bash"]
argument-hint: <server-name>
---

# Inspect MCP Server Config

Safely inspect an MCP server's configuration with automatic secret redaction. Unlike `claude mcp get` which prints raw secret values in plaintext, this command masks sensitive fields so you can debug and verify your config without leaking credentials into your terminal or session history.

## What It Does

Reads the MCP configuration for a specified server from the project-level or global MCP config file and displays it with sensitive values automatically redacted. Headers like `Authorization`, `X-API-Key`, `Token`, `Cookie`, and any value that looks like a credential (secrets, tokens, keys) are replaced with `[REDACTED]`.

## Usage

```
/mcp-guard:inspect myserver
```

## How It Works

1. Read the MCP config from the standard locations:
   - Project config: `.claude/mcp.json` (relative to current working directory)
   - Global config: `~/.claude/mcp.json`

2. Find the server named `$ARGUMENTS` in the config

3. Apply the same redaction logic that `claude mcp add` uses:
   - Mask values for headers matching: `Authorization`, `X-API-Key`, `Api-Key`, `Token`, `Cookie`, `Set-Cookie`, `Secret`, `Credential`
   - Mask any header value that matches patterns like: `Bearer\s+\S+`, `Basic\s+\S+`, `sk-[a-zA-Z0-9]+`, `key\s*=\s*\S+`
   - Mask the `apiKey` field if present in JSON config

4. Display the safe, redacted config

## Display Format

Print the config in a clean, readable format:

```
Server: myserver
  Transport: http
  URL: https://example.com/mcp
  Headers:
    Authorization: [REDACTED]
    X-Custom: plaintext-value (safe)
  Connection: ok
  Last used: 2 minutes ago
```

## When To Use This

- Instead of `claude mcp get` when you just want to verify a server's config
- Before sharing MCP config details with others (in issue reports, PRs, etc.)
- During debugging sessions where you want to avoid leaking secrets into the session transcript
- When you want to double-check that your secrets are properly configured without exposing them

## Notes

- This command only REDACTS the display output - it never modifies your actual config file
- If you need to update secrets, use `claude mcp add` with the `--header` flag (which properly handles redaction)
- The redaction follows the same patterns that `claude mcp add` uses for consistency
- Config files stored on disk are never modified by this command
