# Codex Plugin

OpenAI Codex integration for Claude Code with model selection, permission control, and session management.

> 📦 **Part of:** [Jiusi-pys/claude-code](https://github.com/Jiusi-pys/claude-code)
>
> 📘 **For detailed deployment instructions**, see [DEPLOYMENT.md](./DEPLOYMENT.md)

## Features

- 🔐 OpenAI API key authentication for stable, reliable access
- 🎯 Model selection with persistent defaults
- 🔧 Permission/approval mode configuration
- 📜 Session continuity - follow-up questions maintain context
- 💾 Secure token storage (0600 permissions)
- 🔄 Automatic token refresh
- ⚡ Simple, clean response output
- 🤖 Sub-agent for intelligent session management

## Quick Start

### 1. Log in

```
/codex:login
```

Opens browser for OpenAI OAuth login.

### 2. Query Codex

```
/codex how do I implement binary search?
```

Response shows just the answer - no extra metadata.

### 3. Configure

```
/codex:model gpt-5.2          # Set default model
/codex:permission auto-edit   # Set approval mode
/codex:session                # View session history
```

## Commands

| Command | Purpose |
|---------|---------|
| `/codex <query>` | Query Codex - shows only the answer |
| `/codex:login` | Log in to Codex |
| `/codex:logout` | Log out from Codex |
| `/codex:model [name]` | View/set default model |
| `/codex:permission [mode]` | View/set approval mode |
| `/codex:session [list\|clear]` | Manage session history |

## Models

| Model | Description |
|-------|-------------|
| `gpt-5.2-codex` | Default, balanced |
| `gpt-5.2` | General purpose |
| `gpt-5.1-codex-max` | Complex tasks |
| `gpt-5.1-codex-mini` | Quick responses |

## Approval Modes

| Mode | Description |
|------|-------------|
| `suggest` | Codex suggests, user confirms (default) |
| `auto-edit` | Codex can edit files automatically |
| `full-auto` | Codex has full control |

## Authentication Methods

### API Key (Recommended)

Use an OpenAI API key for stable, reliable access via the official Chat Completions API:

1. Get your API key from https://platform.openai.com/api/keys
2. Run `/codex:login`
3. Select "API Key" option
4. Paste your key when prompted

### ChatGPT Subscription (OAuth)

OAuth authentication via ChatGPT subscription is supported but has limited reliability due to API compatibility issues. If you encounter "Instructions are not valid" errors, switch to API key authentication.

## Session Continuity

Codex sessions maintain conversation context across multiple queries. This allows for follow-up questions without losing context.

**How it works:**
- Each query returns a `session_id` with the response
- Pass the same `session_id` to continue the conversation
- The `codex-session` sub-agent automatically manages this

**Example:**
```
User: How do I implement binary search?
→ Codex explains binary search (session: abc123)

User: Can you make it recursive?
→ Uses session abc123, Codex knows you mean binary search

User: Unrelated - what is REST?
→ New session starts (different topic)
```

## Sub-Agents

| Agent | Description |
|-------|-------------|
| `codex-session` | Manages session continuity, decides when to continue vs start new |

## MCP Tools

| Tool | Description |
|------|-------------|
| `codex_query` | Send query to Codex (with optional session_id for continuation) |
| `codex_status` | Check auth status |
| `codex_login` | Start OAuth flow |
| `codex_clear` | Clear credentials |
| `codex_models` | List models |
| `codex_get_config` | Get current config |
| `codex_set_config` | Set config values |
| `codex_list_sessions` | List sessions |
| `codex_clear_sessions` | Clear session history |

## Configuration Files

| File | Purpose |
|------|---------|
| `~/.claude/auth.json` | OAuth tokens (global) |
| `.claude/codex_config.json` | Project preferences (model, permission, sessions) |

## License

Part of Claude Code. See LICENSE in root repository.

## Changelog

### v1.2.0

- 🔄 Session continuity - follow-up questions maintain context
- 🤖 `codex-session` sub-agent for intelligent session management
- 📁 Project-specific configuration (`.claude/codex_config.json`)
- 🎨 Selection UI for model and permission commands

### v1.1.0

- ✨ Model selection command
- 🔧 Permission configuration
- 📜 Session history tracking
- 🎯 Simplified response output
- 📝 Renamed from `codex-oauth` to `codex`

### v1.0.0

- 🔐 OAuth 2.0 + PKCE authentication
- 📡 MCP server with 5 tools
- 💻 Cross-platform support
