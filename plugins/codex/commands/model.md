---
description: Select Codex model
allowed-tools: []
---

## Your task

Explain how to select a model for Codex queries.

### Output

```
## Codex Model Selection

The OpenAI Codex CLI uses the `--model` flag to specify which model to use.

### Usage

```bash
/codex --model <model> "your query"
```

### Available Models

Common models:
- `o3` - OpenAI's reasoning model
- `gpt-4.1` - GPT-4.1
- `gpt-4o` - GPT-4o (optimized)
- `gpt-4o-mini` - GPT-4o mini (faster)

### Examples

```
/codex --model o3 "explain this algorithm"
/codex --model gpt-4.1 "write a Python function"
```

### Default Model

The default model is determined by the Codex CLI configuration.
You can set it in `~/.codex/config.toml` or via environment variables.

### Provider Support

Codex CLI supports multiple providers:
- openai (default)
- openrouter
- azure
- gemini
- ollama
- mistral
- deepseek
- xai
- groq

Use `--provider <name>` to switch providers.
```
