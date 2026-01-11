---
name: Codex Integration
description: Use this skill when the user mentions "Codex", "OpenAI Codex", wants to "ask Codex", "query Codex", requests AI assistance from OpenAI, or wants alternative AI perspectives on coding questions. Auto-activate for Codex-related queries.
version: 2.0.0
---

# Codex Integration Skill

This skill provides guidelines for integrating OpenAI Codex into Claude Code workflows.

## When to Activate

- User explicitly mentions "Codex" or "OpenAI"
- User wants to "ask Codex" something
- User requests code generation or explanation from Codex
- User wants alternative AI perspectives
- User mentions GPT-5.2 or related OpenAI models

## Architecture (v2.0 - CLI-based)

```
User Request
    ↓
Commands (/codex, /codex:login, etc.)
    ↓
CLI Tool (codex_cli.py) ← Executes operations
    ↓
OpenAI API ← Codex responses
```

## CLI Tool

Location: `${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py`

Invoke via Bash:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" <command> [options]
```

## Available Commands

### Core Commands

| Command | Purpose |
|---------|---------|
| `/codex <query>` | Query Codex |
| `/codex:review [file]` | Request code review from Codex |
| `/codex:compare <query>` | Compare Claude vs Codex responses |

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
| `/codex:status` | Show status, auth, config |
| `/codex:model` | Select default model |
| `/codex:models` | List available models |
| `/codex:reasoning` | Set reasoning effort level |
| `/codex:help` | Show help |

## CLI Commands Reference

| CLI Command | Purpose |
|-------------|---------|
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

## Authentication Methods

| Method    | Description                      | Use Case                         |
|-----------|----------------------------------|----------------------------------|
| `api_key` | OpenAI API key (sk-...)          | Recommended, usage-based billing |
| `oauth`   | ChatGPT subscription via browser | Plus, Pro, Team, Enterprise      |

Use `/codex:login` to configure authentication.

## Session Continuity Guidelines

**Continue existing session when:**

- Follow-up questions referencing previous context
- Same code file or feature being discussed
- User says "continue", "also", "what about..."

**Start new session when:**

- Completely unrelated topic
- User explicitly requests "new session"
- Different project context

## Reasoning Effort Levels

| Level | Description |
|-------|-------------|
| `none` | No extended thinking |
| `minimal` | Very light thinking |
| `low` | Quick responses |
| `medium` | Balanced (default) |
| `high` | Thorough analysis |
| `xhigh` | Maximum thinking |

## Config Files

- **Project config**: `.claude/codex_config.json` (model, reasoning, sessions)
- **Global auth**: `~/.claude/auth.json` (OAuth tokens or API key)
