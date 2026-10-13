---
description: Start a fresh session (old session stays available via /resume)
argument-hint: [session-name]
---

You are handling the `/new` command. The user wants to end the current session and start a completely fresh one. The old session's data must NOT be deleted — it should remain available via `/resume`.

## How to do this

Since `/new` is not a built-in command, you must use the built-in `/clear` command to achieve the same effect:

1. If the user provided an argument (a session name like `$ARGUMENTS`), first tell them:
   "Naming this session **$ARGUMENTS** and starting fresh. You can return to it later with `/resume`."
   Then use `/clear $ARGUMENTS` to clear the conversation with that label.

2. If no argument was provided, tell the user:
   "Starting a fresh session. Your current session is preserved and available via `/resume`."
   Then use `/clear` to reset the conversation.

## Important

- Do NOT delete any session data, files, or history.
- Do NOT run any destructive commands.
- Simply execute the `/clear` command (with optional label) to start fresh.
- Keep your response minimal — just the confirmation message and the `/clear` action.
- The old session remains accessible through `/resume`.
