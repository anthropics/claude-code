# Codex Plugin v2.0

OpenAI Codex integration for Claude Code with CLI-based architecture, model selection, and session management.

> **Part of:** [Jiusi-pys/claude-code](https://github.com/Jiusi-pys/claude-code)

## What's New in v2.0

- **CLI-based architecture** - No more MCP server, simpler and more reliable
- **Reasoning effort control** - Control how much Codex "thinks" before responding
- **Improved session management** - Persistent sessions with context
- **Simplified commands** - Cleaner command interface

## Features

- OpenAI API key authentication (recommended)
- ChatGPT OAuth authentication (Plus/Pro/Team/Enterprise)
- Model selection with persistent defaults
- Reasoning effort levels (none/minimal/low/medium/high/xhigh)
- Session continuity for follow-up questions
- Secure token storage (0600 permissions)
- Automatic token refresh

## Quick Start

### 1. Log in

```
/codex:login
```

Choose API Key (recommended) or ChatGPT OAuth.

### 2. Query Codex

```
/codex how do I implement binary search?
```

### 3. Configure

```
/codex:model             # Select default model
/codex:reasoning         # Set reasoning effort
/codex:status            # Check status
```

## Commands

### Core

| Command | Purpose |
|---------|---------|
| `/codex <query>` | Query Codex |
| `/codex:review [file]` | Request code review |
| `/codex:compare <query>` | Compare Claude vs Codex |

### Session Management

| Command | Purpose |
|---------|---------|
| `/codex:session list` | List sessions |
| `/codex:session clear` | Clear session history |

### Configuration

| Command | Purpose |
|---------|---------|
| `/codex:login` | Log in to Codex |
| `/codex:logout` | Log out from Codex |
| `/codex:status` | Show status and config |
| `/codex:model` | Select default model |
| `/codex:models` | List available models |
| `/codex:reasoning` | Set reasoning effort |
| `/codex:help` | Show help |

## Models

| Model | Description |
|-------|-------------|
| `gpt-5.2-codex` | Default, balanced |
| `gpt-5.2` | General purpose |
| `gpt-5.1-codex-max` | Complex tasks |
| `gpt-5.1-codex-mini` | Quick responses |

## Reasoning Effort Levels

| Level | Description |
|-------|-------------|
| `none` | No extended thinking |
| `minimal` | Very light thinking |
| `low` | Quick responses |
| `medium` | Balanced (default) |
| `high` | Thorough analysis |
| `xhigh` | Maximum thinking |

## Authentication Methods

### API Key (Recommended)

Use an OpenAI API key for stable, reliable access:

1. Get your API key from https://platform.openai.com/api/keys
2. Run `/codex:login`
3. Select "API Key" option
4. Paste your key when prompted

### ChatGPT Subscription (OAuth)

OAuth authentication via ChatGPT subscription is supported for Plus/Pro/Team/Enterprise users.

## Architecture

```
User Request
    ↓
Commands (/codex, /codex:login, etc.)
    ↓
CLI Tool (cli/codex_cli.py) ← Executes via Bash
    ↓
OpenAI API
```

## CLI Tool

The plugin uses a Python CLI tool located at `cli/codex_cli.py`:

```bash
python3 cli/codex_cli.py <command> [options]
```

### CLI Commands

| Command | Purpose |
|---------|---------|
| `query <prompt>` | Send query to Codex |
| `status` | Check auth status |
| `login` | Start OAuth flow |
| `set-api-key <key>` | Set API key |
| `logout` | Clear credentials |
| `models [--fetch]` | List models |
| `set-model <model>` | Set default model |
| `set-reasoning <level>` | Set reasoning effort |
| `get-config` | Get configuration |
| `sessions` | List sessions |
| `clear-sessions` | Clear sessions |

## Configuration Files

| File | Purpose |
|------|---------|
| `~/.claude/auth.json` | OAuth tokens / API key (global) |
| `.claude/codex_config.json` | Project preferences (model, reasoning, sessions) |

## License

Part of Claude Code. See LICENSE in root repository.

## Changelog

### v2.0.0

- **CLI-based architecture** - Removed MCP server, using CLI tool instead
- **Reasoning effort control** - New `/codex:reasoning` command
- **Simplified commands** - Removed deprecated commands
- **Improved reliability** - Direct API calls via CLI

### v1.2.0

- Session continuity
- `codex-session` sub-agent
- Selection UI for model and permission

### v1.1.0

- Model selection
- Permission configuration
- Session history

### v1.0.0

- Initial release with OAuth 2.0 + PKCE
