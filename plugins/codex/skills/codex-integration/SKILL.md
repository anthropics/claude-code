---
name: Codex Integration
description: Use this skill when the user mentions "Codex", "OpenAI Codex", wants to "ask Codex", "query Codex", requests AI assistance from OpenAI, or wants alternative AI perspectives on coding questions. Auto-activate for Codex-related queries.
version: 1.2.0
---

# Codex Integration Skill

Seamlessly integrate OpenAI Codex queries into Claude Code workflows with intelligent session management.

## When to Activate

- User explicitly mentions "Codex" or "OpenAI"
- User wants to "ask Codex" something
- User requests code generation or explanation from Codex
- User wants alternative AI perspectives
- User mentions GPT-5.2 or related OpenAI models

## Session Management

Codex maintains conversation context through sessions. Each session preserves the conversation history.

### Session Continuity

- **Continue existing session**: For follow-up questions, pass the `session_id` to maintain context
- **New session**: For unrelated topics, omit `session_id` to start fresh
- **Session initialization**: For new sessions, confirm purpose and permission level with user

### New Session Protocol

When starting a new Codex session, use **AskUserQuestion** to confirm:

1. **Session purpose**: Code Generation, Code Review, Debugging, or Learning
2. **Permission level**: Suggest (default), Auto-Edit, or Full-Auto

## Available MCP Tools

### Query Tools

- `codex_query` - Send query to Codex with session continuity
  - Parameters: prompt (required), session_id (optional), model, system_prompt, temperature
  - Returns: response, session_id, message_count

### Session Management

- `codex_list_sessions` - List recent sessions with topics
- `codex_get_config` - Get current model and approval mode
- `codex_set_config` - Update configuration

### Authentication

- `codex_status` - Check authentication status
- `codex_login` - Start OAuth authentication flow
- `codex_clear` - Clear stored credentials
- `codex_models` - List available models

## Best Practices

### Session Strategy

1. Check `codex_list_sessions` before querying
2. Identify if user's question relates to existing session
3. Use matching `session_id` for continuations
4. For new sessions, gather context via AskUserQuestion
5. Track session_id in responses for future reference

### Effective Queries

1. Provide clear, specific prompts
2. Include relevant context in the prompt
3. Use system_prompt for specialized behavior
4. Choose appropriate model:
   - `gpt-5.2-codex` - Default, balanced
   - `gpt-5.1-codex-max` - Complex tasks
   - `gpt-5.1-codex-mini` - Quick responses

### Safety Considerations

1. Confirm permission level for new sessions
2. Track permission escalation requests
3. Provide clear session metadata in responses
4. Never bypass user confirmation for new sessions

## Sub-Agents

Use the `codex-session` agent for complex multi-turn Codex interactions that require intelligent session management.

## Usage Examples

### New Session with Confirmation

```
1. codex_status → authenticated
2. codex_list_sessions → no matching session
3. AskUserQuestion → purpose: "Code Generation", permission: "Suggest"
4. codex_query(prompt="...", session_id=null)
5. Response includes new session_id for continuations
```

### Continuing a Session

```
1. codex_list_sessions → find session "abc123" about binary search
2. codex_query(prompt="make it recursive", session_id="abc123")
3. Codex understands context from previous messages
```

### Response Format

```
{Codex response content}

---
Session: abc123 | Messages: 4
```

## Configuration

- **Project config**: `.claude/codex_config.json` stores model, permission, and session history
- **Global auth**: `~/.claude/auth.json` stores OAuth tokens (shared across projects)

## Security Notes

- Tokens stored securely (0600 permissions)
- OAuth with PKCE for secure authentication
- Never expose tokens in logs or output
- Refresh tokens automatically managed
- Permission levels enforced per-session
