---
name: Codex Integration
description: Use this skill when the user mentions "Codex", "OpenAI Codex", wants to "ask Codex", "query Codex", requests AI assistance from OpenAI, or wants alternative AI perspectives on coding questions. Auto-activate for Codex-related queries.
version: 1.0.0
---

# Codex Integration Skill

Seamlessly integrate OpenAI Codex queries into Claude Code workflows.

## When to Activate

- User explicitly mentions "Codex" or "OpenAI"
- User wants to "ask Codex" something
- User requests code generation or explanation from Codex
- User wants alternative AI perspectives
- User mentions GPT-5.2 or related OpenAI models

## Available MCP Tools

### Query Tools
- `codex_query` - Send query to Codex and get response
  - Parameters: prompt (required), model, system_prompt, temperature
  - Returns: AI-generated response

### Management Tools
- `codex_status` - Check authentication status
- `codex_login` - Start OAuth authentication flow
- `codex_clear` - Clear stored credentials
- `codex_models` - List available models

## Best Practices

### Before Querying
1. Check authentication status with `codex_status`
2. If not authenticated, guide user to `/codex-config`
3. Don't attempt queries without valid authentication

### Effective Queries
1. Provide clear, specific prompts
2. Include relevant context in the prompt
3. Use system_prompt for specialized behavior
4. Choose appropriate model for the task:
   - `gpt-5.2-codex` - Default, balanced
   - `gpt-5.1-codex-max` - Complex tasks
   - `gpt-5.1-codex-mini` - Quick responses

### Error Handling
1. Handle authentication errors gracefully
2. Suggest `/codex-config` for auth issues
3. Provide helpful error messages

## Usage Examples

### Simple Query
```
Use codex_query with:
- prompt: "How do I implement a binary search tree in Python?"
```

### Query with Context
```
Use codex_query with:
- prompt: "Review this code and suggest improvements"
- system_prompt: "You are an expert code reviewer. Be thorough but constructive."
- temperature: 0.3 (more deterministic)
```

### Using Specific Model
```
Use codex_query with:
- prompt: "Generate a complex algorithm"
- model: "gpt-5.1-codex-max"
```

## Integration with Claude Code

When using Codex alongside Claude:
1. Codex is a complementary tool, not a replacement
2. Use Codex for:
   - Alternative perspectives
   - Specific OpenAI model capabilities
   - Tasks that benefit from different training data
3. Compare and combine insights from both AI systems
4. Be transparent with users about which AI generated what

## Security Notes

- Tokens stored securely (0600 permissions)
- OAuth with PKCE for secure authentication
- Never expose tokens in logs or output
- Refresh tokens automatically managed
