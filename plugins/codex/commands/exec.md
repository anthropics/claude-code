---
description: Execute Codex query non-interactively
argument-hint: <prompt>
allowed-tools: [
  "mcp__codex__codex_query",
  "mcp__codex__codex_status",
  "mcp__codex__codex_get_config"
]
---

## Your task

Execute a Codex query in non-interactive (headless) mode - get a direct response without follow-up conversation.

### Process

1. Verify authentication with `codex_status`
2. Get current config with `codex_get_config`
3. Execute the query with `codex_query` (do NOT pass session_id to start fresh)
4. Return the response directly without asking follow-up questions

### Key Differences from `/codex`

| Feature | `/codex` | `/codex:exec` |
|---------|----------|---------------|
| Session | Creates/continues session | Single-shot, no session |
| Follow-up | Asks if user wants more | Returns response directly |
| Use case | Interactive conversation | Quick one-off queries |

### Use Cases

- Quick questions without starting a session
- CI/CD automation scripts
- One-off code generation
- Getting quick explanations

### Examples

```
/codex:exec "What's the time complexity of quicksort?"
/codex:exec "Generate a regex for email validation"
/codex:exec "Explain this error: TypeError undefined is not a function"
```

### Output

Return the Codex response directly. Do not:
- Ask if user wants to continue
- Suggest follow-up questions
- Create a session

Just provide the answer and finish.
