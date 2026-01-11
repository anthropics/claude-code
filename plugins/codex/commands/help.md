---
description: Show Codex plugin help and available commands
allowed-tools: []
---

## Your task

Display help information for the Codex plugin.

### Output

```
# OpenAI Codex Plugin for Claude Code

Query OpenAI Codex CLI for AI-powered coding assistance.

## Quick Start

1. Set API key: `export OPENAI_API_KEY=your-key`
2. Check status: `/codex:status`
3. Start querying: `/codex "your question"`

## Commands

| Command | Description |
|---------|-------------|
| `/codex <query>` | Send query to Codex |
| `/codex:status` | Show status and configuration |
| `/codex:model` | Model selection info |
| `/codex:models` | List available models |
| `/codex:review [file]` | Request code review |
| `/codex:compare <query>` | Compare Claude vs Codex |
| `/codex:help` | Show this help |

## CLI Options

When using `/codex`, you can pass these options:

| Option | Description |
|--------|-------------|
| `--model <model>` | Specify model (o3, gpt-4.1, etc.) |
| `--approval-mode <mode>` | suggest, auto-edit, full-auto |
| `--provider <name>` | AI provider (openai, openrouter, etc.) |
| `--image <path>` | Include image (multimodal) |

## Approval Modes

| Mode | Description |
|------|-------------|
| suggest | Reads files, asks before changes (safest) |
| auto-edit | Can edit files, asks before shell commands |
| full-auto | Full autonomy, sandboxed (network disabled) |

## Examples

```bash
# Simple query
/codex "explain REST API design"

# With specific model
/codex --model o3 "solve this algorithm"

# Code review
/codex:review src/main.py

# Compare responses
/codex:compare "best way to implement caching"
```

## Authentication

Set your OpenAI API key:
```bash
export OPENAI_API_KEY="your-api-key"
```

Or add to `.env` file in your project.

## Codex CLI Location

/Users/jiusi/Documents/codex/codex-cli

## More Info

See: https://github.com/openai/codex
```
