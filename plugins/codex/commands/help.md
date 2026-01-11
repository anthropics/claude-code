---
description: Show Codex plugin help and available commands
allowed-tools: []
---

## Your task

Display help information for the Codex plugin.

### Output

```
# OpenAI Codex Plugin for Claude Code

Query OpenAI Codex for alternative AI perspectives, code generation, and reviews.

## Quick Start

1. Configure authentication: /codex:config
2. Check status: /codex:status
3. Start querying: /codex "your question"

## Commands

### Core
| Command | Description |
|---------|-------------|
| /codex <query> | Send query to Codex |
| /codex:exec <query> | Non-interactive query (no session) |
| /codex:review [file] | Request code review |

### Session Management
| Command | Description |
|---------|-------------|
| /codex:resume [id] | Resume previous session |
| /codex:session list | List sessions |
| /codex:session clear | Clear session history |
| /codex:apply [id] | Apply changes from session |

### Configuration
| Command | Description |
|---------|-------------|
| /codex:config | Configure authentication |
| /codex:status | Show current status |
| /codex:model | Select default model |
| /codex:models | List available models |
| /codex:permission | Set approval mode |
| /codex:clear | Clear credentials |

## Authentication Methods

- **ChatGPT Subscription**: OAuth login for Plus/Pro/Team/Enterprise
- **API Key**: Direct OpenAI API key (sk-...)

## Models

- gpt-5.2-codex (default)
- gpt-5.2
- gpt-5.1-codex-max
- gpt-5.1-codex-mini

## More Info

- Project config: .claude/codex_config.json
- Global auth: ~/.claude/auth.json
```
