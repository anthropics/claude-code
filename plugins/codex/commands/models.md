---
description: List available Codex models
allowed-tools: []
---

## Your task

Display information about available Codex models.

### Output

```
## Available Codex Models

The OpenAI Codex CLI supports various models from OpenAI and other providers.

### OpenAI Models

| Model | Description |
|-------|-------------|
| o3 | OpenAI's advanced reasoning model |
| gpt-4.1 | GPT-4.1 |
| gpt-4o | GPT-4o (optimized) |
| gpt-4o-mini | GPT-4o mini (faster, cheaper) |
| gpt-4-turbo | GPT-4 Turbo |

### Usage

```bash
/codex --model <model-name> "your query"
```

### Other Providers

Codex CLI supports multiple AI providers. Set the provider with `--provider`:

- **openrouter**: Access various models via OpenRouter
- **azure**: Azure OpenAI Service
- **gemini**: Google Gemini models
- **ollama**: Local Ollama models
- **mistral**: Mistral AI models
- **deepseek**: DeepSeek models
- **xai**: xAI models (Grok)
- **groq**: Groq models

### Configuration

Set default model in `~/.codex/config.toml`:

```toml
model = "o3"
provider = "openai"
```

Or use environment variables:
- OPENAI_API_KEY
- <PROVIDER>_API_KEY
- <PROVIDER>_BASE_URL
```
