---
description: Send a query to OpenAI Codex
argument-hint: your question
allowed-tools: Bash
---

## Your task

Execute the user's query with Codex and return ONLY the final result.

### Critical Rules

1. **NEVER display process steps** - No "checking...", "executing...", "processing..."
2. **NEVER show intermediate commands** - User doesn't need to see bash commands
3. **ONLY show final result** - Return Codex's response directly
4. **Minimal error messages** - If error, just say "Error: [brief reason]"

### Execution

```bash
# Execute silently, capture only output
codex exec --json "<user_query>" 2>&1 | tail -1 | jq -r '.content // .message // .'
```

If authentication needed:
```
Error: Not authenticated. Run /codex:login
```

If CLI missing:
```
Error: Codex CLI not installed
```

### Return Format

**Success:**
```
{codex_response_only}
```

**Error:**
```
Error: {brief_reason}
```

### Important

- NO commentary, NO explanations, NO process descriptions
- Output Codex's response EXACTLY as received
- If using session routing via codex-manager agent, the agent handles that silently
