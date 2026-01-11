---
description: Show Codex status and configuration
allowed-tools: Bash
---

## Your task

Display OpenAI Codex CLI status and configuration.

### Steps

1. Check API Key:
```bash
[ -n "$OPENAI_API_KEY" ] && echo "OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}...${OPENAI_API_KEY: -4}" || echo "OPENAI_API_KEY: not set"
```

2. Check Codex CLI availability:
```bash
[ -f "/Users/jiusi/Documents/codex/codex-cli/bin/codex.js" ] && echo "Codex CLI: installed" || echo "Codex CLI: not found"
```

3. Show CLI version (if available):
```bash
node /Users/jiusi/Documents/codex/codex-cli/bin/codex.js --version 2>/dev/null || echo "Version: unknown"
```

### Display Format

```
## Codex Status

### Authentication
- API Key: {set/not set} {masked key if set}

### CLI
- Location: /Users/jiusi/Documents/codex/codex-cli
- Status: {installed/not found}

### Configuration
To configure Codex, use these options when running queries:
- --model <model>: Specify model (o3, gpt-4.1, etc.)
- --approval-mode <mode>: suggest (default), auto-edit, full-auto
- --provider <name>: openai, openrouter, azure, etc.

### Setup
If API key is not set:
  export OPENAI_API_KEY="your-api-key"

Or add to .env file in your project:
  OPENAI_API_KEY=your-api-key
```
