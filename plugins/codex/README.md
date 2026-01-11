# Codex Plugin v2.1

OpenAI Codex CLI integration for Claude Code.

> **Part of:** [Jiusi-pys/claude-code](https://github.com/Jiusi-pys/claude-code)

## What's New in v2.1

- **External CLI integration** - Uses the official OpenAI Codex CLI
- **Simplified architecture** - No custom Python CLI, direct CLI invocation
- **Multi-provider support** - OpenAI, OpenRouter, Azure, Gemini, Ollama, etc.
- **Multimodal queries** - Support for image inputs

## Prerequisites

1. **OpenAI Codex CLI** installed at `/Users/jiusi/Documents/codex/codex-cli`
2. **OpenAI API Key** set as environment variable

## Quick Start

### 1. Set API Key

```bash
export OPENAI_API_KEY="your-api-key"
```

### 2. Check Status

```
/codex:status
```

### 3. Query Codex

```
/codex "your question here"
```

## Commands

| Command | Description |
|---------|-------------|
| `/codex <query>` | Send query to Codex |
| `/codex:status` | Show status and configuration |
| `/codex:model` | Model selection info |
| `/codex:models` | List available models |
| `/codex:review [file]` | Request code review |
| `/codex:compare <query>` | Compare Claude vs Codex |
| `/codex:help` | Show help |

## CLI Options

Pass these options with `/codex`:

| Option | Description |
|--------|-------------|
| `--model <model>` | Specify model (o3, gpt-4.1, etc.) |
| `--approval-mode <mode>` | suggest, auto-edit, full-auto |
| `--provider <name>` | AI provider |
| `--image <path>` | Include image (multimodal) |
| `--quiet` | Non-interactive mode |

## Approval Modes

| Mode | Description |
|------|-------------|
| `suggest` | Reads files, asks before any changes (safest, default) |
| `auto-edit` | Can edit files, asks before shell commands |
| `full-auto` | Full autonomy, sandboxed (network disabled) |

## Models

Common OpenAI models:
- `o3` - Advanced reasoning model
- `gpt-4.1` - GPT-4.1
- `gpt-4o` - GPT-4o (optimized)
- `gpt-4o-mini` - GPT-4o mini (faster)

## Providers

Codex CLI supports multiple AI providers:
- openai (default)
- openrouter
- azure
- gemini
- ollama
- mistral
- deepseek
- xai
- groq

## Examples

```bash
# Simple query
/codex "explain REST API design"

# With specific model
/codex --model o3 "solve this algorithm"

# Full auto mode
/codex --approval-mode full-auto "refactor this function"

# Code review
/codex:review src/main.py

# Compare AI responses
/codex:compare "best caching strategy"
```

## Architecture

```
User Request
    ↓
Plugin Commands (/codex, /codex:review, etc.)
    ↓
OpenAI Codex CLI (/Users/jiusi/Documents/codex/codex-cli)
    ↓
OpenAI API
```

## Codex CLI Location

```
/Users/jiusi/Documents/codex/codex-cli/bin/codex.js
```

## More Information

- [OpenAI Codex Repository](https://github.com/openai/codex)
- [Codex CLI Documentation](https://github.com/openai/codex/tree/main/codex-cli)

## Changelog

### v2.1.0

- Use external OpenAI Codex CLI instead of custom Python CLI
- Removed: Python CLI, OAuth login, session management, reasoning effort
- Added: Multi-provider support, multimodal queries, approval modes
- Simplified command structure

### v2.0.0

- CLI-based architecture (Python)
- Removed MCP server

### v1.x

- MCP server with OAuth authentication
