---
description: Apply code changes suggested by Codex
argument-hint: [session_id]
allowed-tools: [
  "mcp__codex__codex_list_sessions",
  "mcp__codex__codex_query",
  "Read",
  "Edit",
  "Write",
  "Bash",
  "AskUserQuestion"
]
---

## Your task

Apply code changes from a Codex session response to the codebase.

### Process

1. Get the session to apply from:
   - If session_id provided, use that session
   - Otherwise, use `codex_list_sessions` and pick the most recent
2. Ask Codex to regenerate the changes in a structured format
3. Parse the suggested changes
4. Show changes to user for confirmation
5. Apply approved changes using Edit/Write tools

### Structured Change Request

When asking Codex to provide changes, use this prompt:

```
Based on our previous conversation, provide the code changes in this exact format:

FILE: path/to/file.ts
ACTION: modify|create|delete
```diff
--- a/path/to/file.ts
+++ b/path/to/file.ts
@@ -line,count +line,count @@
 context line
-removed line
+added line
 context line
```

List all files that need changes.
```

### User Confirmation

Before applying, show the user:
```
## Proposed Changes

### Modify: src/auth.ts
- Line 42: Update validation logic
- Line 56-60: Add error handling

### Create: src/utils/helpers.ts
- New utility functions

Apply these changes? [Yes/No/Review each]
```

### Apply Options

Use **AskUserQuestion** to let user choose:
- **Apply All** - Apply all changes at once
- **Review Each** - Confirm each file individually
- **Cancel** - Don't apply any changes

### Notes

- Always show diffs before applying
- Use Edit tool for modifications
- Use Write tool for new files
- Create backup or suggest git commit before major changes
