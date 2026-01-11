---
description: Manage Codex sessions
argument-hint: [list|show <id>|cleanup]
allowed-tools: Bash, Read
---

## Your task

Manage Codex sessions using the session registry.

### Session Registry Path
```
~/.codex/claude-sessions.json
```

### Step 1: Determine Action

If no argument provided, default to "list".

### Action: List Sessions

Display all tracked sessions from the registry:

```bash
if [ -f ~/.codex/claude-sessions.json ]; then
  cat ~/.codex/claude-sessions.json | jq -r '.sessions[] | "[\(.status)] \(.id[0:8])... - \(.task_summary) (Last used: \(.last_used))"'
else
  echo "No session registry found. Sessions will be created when you use /codex commands."
fi
```

### Action: Show Session Details

Show detailed information about a specific session:

```bash
SESSION_ID="<user_provided_id>"
if [ -f ~/.codex/claude-sessions.json ]; then
  cat ~/.codex/claude-sessions.json | jq --arg id "$SESSION_ID" '.sessions[] | select(.id == $id or (.id | startswith($id)))'
else
  echo "Session registry not found"
fi
```

Also check if the session exists in Codex's storage:

```bash
ls -la ~/.codex/threads/ | grep "$SESSION_ID"
```

### Action: Cleanup

Remove old or inactive sessions from registry:

```bash
if [ -f ~/.codex/claude-sessions.json ]; then
  # Show sessions marked for cleanup (status: completed, failed, or not used in 7+ days)
  echo "Sessions eligible for cleanup:"
  cat ~/.codex/claude-sessions.json | jq -r '.sessions[] | select(.status != "active") | "[\(.status)] \(.id[0:8])... - \(.task_summary)"'

  # Archive old sessions (change status to archived, don't delete)
  # Clean up any stale temp file first
  rm -f ~/.codex/claude-sessions.json.tmp

  # Use correct jq syntax with map
  jq '.sessions |= map(if (.status == "completed" or .status == "failed") then .status = "archived" else . end)' \
    ~/.codex/claude-sessions.json > ~/.codex/claude-sessions.json.tmp && \
    mv ~/.codex/claude-sessions.json.tmp ~/.codex/claude-sessions.json

  echo "Sessions archived. Registry updated."
else
  echo "No session registry to cleanup"
fi
```

### Output Format

**For list:**
```
## Codex Sessions

Active Sessions:
[active] abc12345... - Implement authentication flow (Last used: 2026-01-12T10:30:00Z)
[active] def67890... - Database optimization (Last used: 2026-01-12T09:15:00Z)

Archived Sessions:
[archived] ghi11111... - Bug fix task (Last used: 2026-01-10T14:20:00Z)

Total: 3 sessions (2 active, 1 archived)

Use /codex:sessions show <id> for details
```

**For show:**
```
## Session Details

ID: abc12345-1234-5678-90ab-cdef12345678
Task: Implement authentication flow
Status: active
Created: 2026-01-12T10:00:00Z
Last Used: 2026-01-12T10:30:00Z
Keywords: auth, authentication, login, jwt
Conversation Turns: 5

To resume this session manually:
  codex resume abc12345-1234-5678-90ab-cdef12345678
```

**For cleanup:**
```
## Session Cleanup

Sessions eligible for cleanup:
[completed] ghi11111... - Bug fix task
[failed] jkl22222... - Failed migration attempt

✓ 2 sessions archived
Registry updated at: ~/.codex/claude-sessions.json

Note: Archived sessions are preserved but won't appear in active routing.
To permanently delete, manually edit the registry file.
```

### Registry Management

**Initialize registry if missing:**
```bash
if [ ! -f ~/.codex/claude-sessions.json ]; then
  echo '{"version":"1.0.0","sessions":[]}' > ~/.codex/claude-sessions.json
  echo "Created new session registry at ~/.codex/claude-sessions.json"
fi
```

### Important Notes

- Session registry is separate from Codex's own thread storage (`~/.codex/threads/`)
- The registry tracks task context for intelligent routing
- Codex threads persist even if removed from registry
- To fully delete a session, remove from both registry and `~/.codex/threads/`
