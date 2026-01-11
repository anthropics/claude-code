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

1. Log in: /codex:login
2. Check status: /codex:status
3. Start querying: /codex "your question"

## Commands

### Core
| Command | Description |
|---------|-------------|
| /codex <query> | Send query to Codex |
| /codex:review [file] | Request code review |
| /codex:compare | Compare Claude vs Codex responses |

### Session Management
| Command | Description |
|---------|-------------|
| /codex:session list | List sessions |
| /codex:session clear | Clear session history |

### Configuration
| Command | Description |
|---------|-------------|
| /codex:login | Log in to Codex |
| /codex:logout | Log out from Codex |
| /codex:status | Show current status |
| /codex:model | Select default model |
| /codex:models | List available models |
| /codex:reasoning | Set reasoning effort level |

## Authentication Methods

- **API Key (Recommended)**: Direct OpenAI API key (sk-...)
- **ChatGPT Subscription**: OAuth login for Plus/Pro/Team/Enterprise

## Models

- gpt-5.2-codex (default)
- gpt-5.2
- gpt-5.1-codex-max
- gpt-5.1-codex-mini

## Reasoning Effort Levels

- none, minimal, low, medium (default), high, xhigh

## Storage

- Project config: .claude/codex_config.json
- Global auth: ~/.claude/auth.json
```
