---
name: Codex Integration
description: Use this skill when the user mentions "Codex", "OpenAI Codex", wants to "ask Codex", "query Codex", requests AI assistance from OpenAI, or wants alternative AI perspectives on coding questions. Auto-activate for Codex-related queries.
version: 1.3.0
---

# Codex Integration Skill

This skill provides guidelines for integrating OpenAI Codex into Claude Code workflows.

## When to Activate

- User explicitly mentions "Codex" or "OpenAI"
- User wants to "ask Codex" something
- User requests code generation or explanation from Codex
- User wants alternative AI perspectives
- User mentions GPT-5.2 or related OpenAI models

## Architecture

```
User Request
    ↓
Commands (/codex, /codex:login, etc.)
    ↓
Sub-agent (codex-session) ← Controls, decides, confirms
    ↓
MCP Server (codex) ← Executes API calls
```

## Sub-Agent: codex-session

The `codex-session` agent is responsible for:

1. **Session Management**: Decides when to continue existing sessions vs start new ones
2. **Permission Control**: Confirms permission levels before operations
3. **Safety Confirmations**: Uses AskUserQuestion for user confirmations
4. **Query Routing**: Calls MCP tools with appropriate session context

## Available Commands

### Core Commands

| Command | Purpose |
|---------|---------|
| `/codex <query>` | Query Codex (routes through sub-agent) |
| `/codex:exec <query>` | Non-interactive query (no session) |
| `/codex:review [file]` | Request code review from Codex |
| `/codex:compare <query>` | Compare Claude vs Codex responses |

### Session Management

| Command | Purpose |
|---------|---------|
| `/codex:resume [id]` | Resume previous session |
| `/codex:session list` | List sessions |
| `/codex:session clear` | Clear session history |
| `/codex:apply [id]` | Apply changes from session |

### Configuration

| Command | Purpose |
|---------|---------|
| `/codex:login` | Log in to Codex |
| `/codex:logout` | Log out from Codex |
| `/codex:status` | Show status, auth, config, sessions |
| `/codex:model` | Select default model (interactive) |
| `/codex:models` | List available models |
| `/codex:permission` | Set approval mode (interactive) |
| `/codex:help` | Show help and all commands |

## MCP Tools (for sub-agent use)

| Tool | Purpose |
|------|---------|
| `codex_query` | Execute query with session context |
| `codex_status` | Check auth status |
| `codex_login` | Start OAuth flow (ChatGPT subscription) |
| `codex_set_api_key` | Set API key (usage-based billing) |
| `codex_get_config` | Read configuration |
| `codex_set_config` | Update configuration |
| `codex_list_sessions` | List recent sessions |
| `codex_clear_sessions` | Clear session history |

## Authentication Methods

| Method    | Description                      | Use Case                         |
|-----------|----------------------------------|----------------------------------|
| `oauth`   | ChatGPT subscription via browser | Plus, Pro, Team, Enterprise      |
| `api_key` | OpenAI API key (sk-...)          | Usage-based billing              |

Use `/codex:login` to configure authentication. The command uses AskUserQuestion to let users choose their preferred method.

## Session Continuity Guidelines

**Continue existing session when:**

- Follow-up questions referencing previous context
- Same code file or feature being discussed
- User says "continue", "also", "what about..."

**Start new session when:**

- Completely unrelated topic
- User explicitly requests "new session"
- Different project context

## Permission Levels

| Mode | Behavior |
|------|----------|
| `suggest` | Codex suggests, user confirms (default) |
| `auto-edit` | Codex can edit files automatically |
| `full-auto` | Codex has full control |

## Config Files

- **Project config**: `.claude/codex_config.json` (model, permission, sessions)
- **Global auth**: `~/.claude/auth.json` (OAuth tokens or API key)
