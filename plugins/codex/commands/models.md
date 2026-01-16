---
description: List available OpenAI Codex models
allowed-tools: Bash
---

## Your task

Query and display the actual list of available OpenAI Codex models.

### Step 1: Query Available Models

Call the Codex CLI to get the current list of available models:

```bash
codex models 2>&1
```

This will return a list of models available from OpenAI API based on your current authentication.

### Step 2: Parse Model List

Process the output to extract model information. The CLI may return models in various formats:

```bash
# Extract model IDs and descriptions
codex models 2>&1 | grep -E "^(gpt-|o3|claude-)" | sort
```

### Step 3: Get Model Details

For each model, you can query additional details:

```bash
# Example: Get model capabilities
codex --model gpt-5.2 --help 2>&1
```

### Step 4: Display Model List

Format the output in a structured table:

```
## Available OpenAI Codex Models

{dynamically_generated_from_codex_models_output}

### Current Models (as of query):

| Model ID | Description | Context | Capabilities |
|----------|-------------|---------|--------------|
| gpt-5.2 | Latest GPT-5.2 | 200K | Reasoning, Code, Multimodal |
| o3 | OpenAI o3 | 128K | Advanced Reasoning |
| gpt-4.1 | GPT-4.1 | 128K | Balanced Performance |
| gpt-4o | GPT-4o | 128K | Optimized Speed |
| gpt-4o-mini | GPT-4o Mini | 128K | Fast & Economical |
| gpt-4-turbo | GPT-4 Turbo | 128K | Legacy Support |

### Model Features

**Reasoning Models** (o3, gpt-5.2):
- Support `--reasoning-effort` flag
- Effort levels: low, medium, high, max
- Optimized for complex problem-solving

**Multimodal Models** (gpt-4o, gpt-5.2):
- Support `--image` flag for image inputs
- Can analyze code + visual content

**Fast Models** (gpt-4o-mini):
- Lower latency
- Cost-effective for simple queries
- Good for rapid iteration

### Usage Examples

```bash
# List all models with details
codex models

# Use a specific model
/codex --model gpt-5.2 "your query"

# Use with reasoning effort
/codex --model o3 --reasoning-effort high "complex problem"

# Configure default model
/codex:model
```

### Provider Information

Current provider: OpenAI
API Endpoint: https://api.openai.com/v1

To use models from other providers, use the `--provider` flag:
- `--provider openrouter` - Access various models
- `--provider azure` - Azure OpenAI Service
- `--provider gemini` - Google Gemini models

### Checking Model Availability

Your available models depend on:
- Authentication status (API key or ChatGPT subscription)
- OpenAI API access level
- Organization/account limits

Run `/codex:status` to check your current configuration.
```

### Important Notes

- Model availability changes as OpenAI releases new models
- Some models require specific API access levels
- Pricing varies by model (gpt-4o-mini is most economical)
- Use `/codex:model` to configure your default model interactively
