# Bug Report: Duplicate tool_result blocks with same tool_use_id

## Summary
When a tool call fails (particularly observed with the Tmux tool), two `tool_result` blocks are incorrectly sent to the API with the same `tool_use_id`, causing an API error:

```
API Error: 400
{"type":"error","error":{"type":"invalid_request_error","message":"messages.X.content.1: each tool_use must have a single result. Found multiple `tool_result` blocks with id: toolu_XXX"}}
```

## Root Cause
The parallel tool execution error handling code sends a "Sibling tool call errored" message even for the tool that actually failed, when it should only send this message for OTHER sibling tools in the parallel batch.

## Reproduction
1. Execute a tool call that will fail (e.g., Tmux select-pane on a non-existent window)
2. Observe two tool_result messages being generated:
   - First: The actual error result ("Window not found...")
   - Second: A "<tool_use_error>Sibling tool call errored</tool_use_error>" message with the SAME tool_use_id

## Example JSON (from reported incident)
```json
// Assistant requests tool use
{
  "type": "tool_use",
  "id": "toolu_01K2K2KFvUrwA9PaHGp652zW",
  "name": "Tmux",
  "input": {"args": ["select-pane", "-t", "test-perms3:0.0"]}
}

// First tool_result (correct - actual error)
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "tool_use_id": "toolu_01K2K2KFvUrwA9PaHGp652zW",
      "type": "tool_result",
      "content": "Window not found. The specified window may not exist.",
      "is_error": true
    }]
  }
}

// Second tool_result (BUG - same tool_use_id!)
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "type": "tool_result",
      "content": "<tool_use_error>Sibling tool call errored</tool_use_error>",
      "is_error": true,
      "tool_use_id": "toolu_01K2K2KFvUrwA9PaHGp652zW"
    }]
  }
}
```

## Expected Behavior
- When a tool fails, only ONE tool_result should be sent for that tool_use_id
- The "Sibling tool call errored" message should ONLY be sent for OTHER tool_use_ids in a parallel batch, not for the tool that actually errored

## Suggested Fix Location
The fix should be in the code that handles parallel tool execution errors:

```typescript
// Pseudocode for the fix
function handleParallelToolResults(toolUseIds: string[], failedToolId: string, error: Error) {
  const results = [];

  for (const id of toolUseIds) {
    if (id === failedToolId) {
      // Send actual error for the failed tool
      results.push({
        tool_use_id: id,
        type: "tool_result",
        content: error.message,
        is_error: true
      });
    } else {
      // Only send sibling error for OTHER tools
      results.push({
        tool_use_id: id,
        type: "tool_result",
        content: "<tool_use_error>Sibling tool call errored</tool_use_error>",
        is_error: true
      });
    }
  }

  return results;
}
```

Additionally, a deduplication check before sending to the API would prevent this:
```typescript
function deduplicateToolResults(messages: Message[]): Message[] {
  const seenToolUseIds = new Set<string>();
  return messages.filter(msg => {
    if (msg.type === "tool_result") {
      if (seenToolUseIds.has(msg.tool_use_id)) {
        return false; // Skip duplicate
      }
      seenToolUseIds.add(msg.tool_use_id);
    }
    return true;
  });
}
```

## Related CHANGELOG Fixes
Similar issues have been fixed before:
- v1.0.84: "Fix tool_use/tool_result id mismatch error when network is unstable"
- v2.0.0: "Hooks: Reduced PostToolUse 'tool_use' ids were found without 'tool_result' blocks errors"
- v2.0.22: "Fix bug causing duplicate permission prompts with parallel tool calls"

## Reported By
Issue reported via Slack with multiple reproductions showing the Tmux tool triggering this bug.

## Request IDs (for debugging)
- req_011CVt2KXhCGmrL2YN9sSZQP
- req_011CVtFYJLPxn9oB9FEkCnRr
- req_011CVtG1PREveTLikakXGEdn
