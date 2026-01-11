---
description: Send a query to OpenAI Codex
argument-hint: your question
allowed-tools: Bash
---

## Your task

Send the user's query to OpenAI Codex CLI.

### Codex CLI Path
```
/Users/jiusi/Documents/codex/codex-cli/bin/codex.js
```

### Step 1: Check API Key

```bash
[ -n "$OPENAI_API_KEY" ] && echo "API key is set" || echo "API key not set"
```

If not set, tell user: "Please set OPENAI_API_KEY environment variable: `export OPENAI_API_KEY=your-key`"

### Step 2: Execute Query

Run the Codex CLI with the user's query:

```bash
node /Users/jiusi/Documents/codex/codex-cli/bin/codex.js --quiet "<user_prompt>"
```

**With specific model:**
```bash
node /Users/jiusi/Documents/codex/codex-cli/bin/codex.js --model <model> --quiet "<user_prompt>"
```

### Step 3: Return Response

Display the Codex response to the user.

### Options

| Option | Description |
|--------|-------------|
| `--model <model>` | Specify model (e.g., o3, gpt-4.1) |
| `--approval-mode <mode>` | suggest, auto-edit, full-auto |
| `--image <path>` | Include image (multimodal) |
| `--quiet` | Non-interactive mode |

### Important

- **DO NOT ask permission questions** for simple queries
- Just execute and return the response
- Use `--quiet` for non-interactive mode
