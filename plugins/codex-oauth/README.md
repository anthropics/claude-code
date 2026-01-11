# Codex OAuth Plugin

OpenAI Codex integration for Claude Code with secure OAuth 2.0 + PKCE authentication. Query OpenAI's Codex models directly from Claude Code using convenient commands, skills, and MCP tools.

> 📦 **Part of:** [Jiusi-pys/claude-code](https://github.com/Jiusi-pys/claude-code)
>
> 📘 **For detailed deployment and usage instructions**, see [DEPLOYMENT.md](./DEPLOYMENT.md)

## Features

- 🔐 Secure OAuth 2.0 + PKCE authentication with OpenAI
- 💾 Token storage with secure file permissions (0600)
- 🔄 Automatic token refresh before expiry
- 🛠️ Easy-to-use commands: `/codex`, `/codex-config`, `/codex-clear`
- 📡 MCP server exposing 5 tools for programmatic access
- ⚡ Cross-platform compatible (Unix/Windows)
- 🎯 Auto-activation skill for Codex-related queries

## Quick Start

### 1. Authenticate

```
/codex-config
```

This opens your browser for OpenAI OAuth login. Tokens are stored securely in `~/.claude/auth.json`.

### 2. Query Codex

```
/codex how do I implement binary search in Python?
```

### 3. Manage Credentials

```
/codex-clear    # Clear stored credentials
/codex-config   # Check status or re-authenticate
```

## Available Commands

| Command | Purpose |
|---------|---------|
| `/codex <query>` | Query OpenAI Codex |
| `/codex-config` | Authenticate or check status |
| `/codex-clear` | Clear stored credentials |

## Available Models

- `gpt-5.2-codex` (default)
- `gpt-5.1-codex-max`
- `gpt-5.1-codex-mini`
- `gpt-5.2`

## MCP Tools

The plugin exposes 5 MCP tools for programmatic access:

- **codex_query** - Send queries to Codex with custom models and parameters
- **codex_status** - Check authentication status and token expiry
- **codex_login** - Initiate OAuth authentication flow
- **codex_clear** - Clear stored credentials
- **codex_models** - List available models

## Architecture

### Three-Layer Design

**Infrastructure** - Low-level utilities
- PKCE generator (RFC 7636 compliant)
- Secure token storage with file locking
- HTTP client with retry logic

**Services** - Business logic
- OAuth 2.0 + PKCE flow manager
- Token lifecycle management with auto-refresh
- Codex API client

**MCP Server** - Interface
- JSON-RPC 2.0 protocol implementation
- 5 tools exposed via Model Context Protocol

## Getting Help

Comprehensive guides available in [DEPLOYMENT.md](./DEPLOYMENT.md):

- **Installation**: Complete setup instructions
- **Troubleshooting**: Common issues and solutions
- **Configuration**: Customizing ports and timeouts
- **Development**: Project structure and testing
- **Security**: OAuth and token security details
- **Limitations**: Known constraints and design decisions

## Key Points

✅ **Production Ready**
- Comprehensive error handling
- Cross-platform testing
- Full documentation included

✅ **Secure by Default**
- OAuth 2.0 + PKCE authentication
- Secure token storage (0600 permissions)
- Atomic file operations
- Thread-safe callback handling

✅ **User Friendly**
- Simple 3-step setup
- Auto-token refresh
- Clear error messages
- Auto-activation skill

## Repository

- **Fork**: [Jiusi-pys/claude-code](https://github.com/Jiusi-pys/claude-code)
- **Upstream**: [anthropics/claude-code](https://github.com/anthropics/claude-code)

## License

Part of Claude Code. See LICENSE in root repository.

## Changelog

### v1.0.0 (Initial Release)

- ✨ OAuth 2.0 + PKCE authentication
- 🔐 Secure token storage with 0600 permissions
- 🔄 Automatic token refresh
- 📡 MCP server with 5 tools
- 💻 Cross-platform compatibility (Unix/Windows)
- 🎯 Auto-activation skill for Codex queries
- ⚡ Ready for production use
