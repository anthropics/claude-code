# Session Persist

Client-side session state persistence — checkpoint work, then restore it in any future session.

## Problem

Every session starts from a blank slate. Close the window mid-task and you lose all context. The next session requires reconstructing what was being worked on from memory or scratch.

## How it works

Two hooks run automatically:

| Hook | When | What it does |
|------|------|--------------|
| **SessionStart** | New session opens | Generates a unique `SESSION_ID` and exports it as `CLAUDE_PERSIST_SESSION_ID`. If `.claude/.session-resume` exists, loads the named session's saved context instead. |
| **SessionEnd** | Session closes | Stamps `ended_at` on any session file that was explicitly saved during the session. |

Context is checkpointed **on demand** with `/session-save`. The assistant summarises the current working state and writes it to `.claude/sessions/<session-id>.json`.

## Commands

| Command | Description |
|---------|-------------|
| `/session-save` | Checkpoint the current session with a task description and context summary |
| `/session-list` | List all saved sessions for this project |
| `/session-resume <id>` | Inject a saved session's context into the current conversation |

## Typical workflow

```
# Working on a feature — checkpoint before closing
/session-save

# Open a new session later, restore the context manually
/session-resume sess_20250504_143022_12345

# Or auto-resume on next start
echo "sess_20250504_143022_12345" > .claude/.session-resume
# (next session will inject the saved context automatically)
```

## Session data

Sessions are stored as JSON in `.claude/sessions/`:

```json
{
  "session_id": "sess_20250504_143022_12345",
  "saved_at": "2025-05-04T14:30:22Z",
  "last_task": "Implementing the logout endpoint in auth.ts",
  "summary": "Refactoring auth middleware to remove server-side session tokens per compliance requirements. Login flow complete. Logout and token-refresh endpoints remain.",
  "ended_at": "2025-05-04T15:01:44Z"
}
```

## Limitations

This plugin manages **client-side** context restoration only — it snapshots what the assistant knows and replays it at the start of the next session. The underlying agent loop is still window-bound.

Full server-side session persistence (keeping the agent running after the window closes, resuming mid-tool-call from another machine) requires platform-level support. This plugin is intended as a stopgap and a reference implementation for the patterns that feature will build on. See issue [#55860](https://github.com/anthropics/claude-code/issues/55860).
