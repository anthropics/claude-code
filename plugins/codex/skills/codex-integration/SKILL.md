---
name: Codex Integration
description: Use this skill when the user mentions "Codex", "OpenAI Codex", wants to "ask Codex", "query Codex", requests AI assistance from OpenAI, or wants alternative AI perspectives on coding questions. Auto-activate for Codex-related queries.
version: 2.1.0
---

# Codex Integration Skill

This skill provides guidelines for integrating OpenAI Codex CLI into Claude Code workflows.

## When to Activate

- User explicitly mentions "Codex" or "OpenAI"
- User wants to "ask Codex" something
- User requests code generation or explanation from Codex
- User wants alternative AI perspectives
- User mentions o3, GPT-4.1, or related OpenAI models

## Architecture (v2.1 - External CLI)

```
User Request
    ↓
Commands (/codex, /codex:review, etc.)
    ↓
OpenAI Codex CLI (/Users/jiusi/Documents/codex/codex-cli)
    ↓
OpenAI API
```

## Codex CLI

**Location:** `/Users/jiusi/Documents/codex/codex-cli/bin/codex.js`

**Invoke:**
```bash
node /Users/jiusi/Documents/codex/codex-cli/bin/codex.js [options] [prompt]
```

## Available Commands

| Command | Purpose |
|---------|---------|
| `/codex <query>` | Query Codex |
| `/codex:status` | Show status and configuration |
| `/codex:model` | Model selection info |
| `/codex:models` | List available models |
| `/codex:review [file]` | Request code review |
| `/codex:compare <query>` | Compare Claude vs Codex |
| `/codex:help` | Show help |

## CLI Options

| Option | Description |
|--------|-------------|
| `--model <model>` | Specify model (o3, gpt-4.1, etc.) |
| `--approval-mode <mode>` | suggest, auto-edit, full-auto |
| `--provider <name>` | AI provider (openai, openrouter, etc.) |
| `--image <path>` | Include image (multimodal) |
| `--quiet` | Non-interactive mode |

## Approval Modes

| Mode | Description |
|------|-------------|
| `suggest` | Reads files, asks before any changes (default, safest) |
| `auto-edit` | Can edit files, asks before shell commands |
| `full-auto` | Full autonomy, sandboxed (network disabled) |

## Authentication

Requires `OPENAI_API_KEY` environment variable:
```bash
export OPENAI_API_KEY="your-api-key"
```

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

## Models

Common OpenAI models:
- `o3` - Advanced reasoning
- `gpt-4.1` - GPT-4.1
- `gpt-4o` - GPT-4o (optimized)
- `gpt-4o-mini` - GPT-4o mini (faster)
