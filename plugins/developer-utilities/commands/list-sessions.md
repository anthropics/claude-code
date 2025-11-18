---
description: List Claude Code sessions with context, labels, and activity timeline
---

## Your Task

**Display** all Claude Code sessions with timestamps, projects, activity counts, and user-defined labels to help identify and resume the right session.

**IMPORTANT:**
- Read-only analysis (safe to run anytime)
- Shows sessions from `~/.claude/history.jsonl`
- Displays user labels from `~/.claude/session-labels.json` if they exist
- Sorted by most recent activity first

## Context

Claude Code sessions are stored in:
- `~/.claude/history.jsonl` - All session activity with timestamps and projects
- `~/.claude/session-env/[session-id]/` - Session environment directories
- `~/.claude/session-labels.json` - User-defined labels (optional)

Issue #3605 requests better session identification. This command addresses that by showing:
- Session IDs (for use with /resume)
- User labels (set with /label-session)
- Project paths
- First and last activity timestamps
- Total interaction count
- First user message (as context)

## Commands to Execute

### Step 1: Check if history.jsonl exists

```bash
if [ -f ~/.claude/history.jsonl ]; then echo "Found history file"; else echo "ERROR: ~/.claude/history.jsonl not found. No sessions to display."; exit 1; fi
```

### Step 2: Load session labels (if they exist)

```bash
LABELS_FILE=~/.claude/session-labels.json && if [ -f "$LABELS_FILE" ]; then echo "Labels file found at $LABELS_FILE"; else echo "No labels file yet. Use /label-session to create labels."; fi
```

### Step 3: Parse and display sessions

Parse history.jsonl, group by sessionId, and display with labels:

```bash
cat ~/.claude/history.jsonl | jq -r '.sessionId' | sort | uniq -c | sort -rn | head -20
```

### Step 4: Create and run a script to display detailed session information

Create a temporary script file to process the sessions (this avoids bash escaping issues):

Use the Write tool to create `/tmp/list-claude-sessions.sh` with the following content:

```bash
#!/bin/bash
echo "=== Claude Code Sessions (Most Recent First) ==="
echo ""

# Get last 20 unique sessions
cat ~/.claude/history.jsonl | jq -r '.sessionId' | sort | uniq | tail -20 | tac | while read session_id; do
  # Get session details
  FIRST_TS=$(cat ~/.claude/history.jsonl | jq -r "select(.sessionId==\"$session_id\") | .timestamp" | head -1)
  LAST_TS=$(cat ~/.claude/history.jsonl | jq -r "select(.sessionId==\"$session_id\") | .timestamp" | tail -1)
  PROJECT=$(cat ~/.claude/history.jsonl | jq -r "select(.sessionId==\"$session_id\") | .project" | head -1)
  COUNT=$(cat ~/.claude/history.jsonl | jq -r "select(.sessionId==\"$session_id\")" | wc -l)
  FIRST_MSG=$(cat ~/.claude/history.jsonl | jq -r "select(.sessionId==\"$session_id\") | .display" | grep -v "^/StartOfTheDay" | grep -v "^$" | head -1 | cut -c1-60)

  # Get label if exists
  LABEL=""
  if [ -f ~/.claude/session-labels.json ]; then
    LABEL=$(jq -r --arg sid "$session_id" '.[$sid].label // ""' ~/.claude/session-labels.json 2>/dev/null)
  fi

  # Convert timestamps to dates
  FIRST_DATE=$(date -d "@$((FIRST_TS/1000))" "+%Y-%m-%d %H:%M" 2>/dev/null || date -r "$((FIRST_TS/1000))" "+%Y-%m-%d %H:%M" 2>/dev/null)
  LAST_DATE=$(date -d "@$((LAST_TS/1000))" "+%Y-%m-%d %H:%M" 2>/dev/null || date -r "$((LAST_TS/1000))" "+%Y-%m-%d %H:%M" 2>/dev/null)

  # Display session info
  echo "Session: $session_id"
  if [ -n "$LABEL" ]; then
    echo "  Label: $LABEL"
  fi
  echo "  Project: $PROJECT"
  echo "  Started: $FIRST_DATE"
  echo "  Last Activity: $LAST_DATE"
  echo "  Interactions: $COUNT"
  if [ -n "$FIRST_MSG" ]; then
    echo "  First Message: $FIRST_MSG..."
  fi
  echo ""
done
```

Then make it executable and run it:

```bash
chmod +x /tmp/list-claude-sessions.sh && /tmp/list-claude-sessions.sh
```

### Step 5: Show usage instructions

```bash
echo "=== Usage Instructions ===" && echo "" && echo "To resume a session:" && echo "  Type 'claude --resume' and select from the list" && echo "" && echo "To label a session:" && echo "  /label-session <session-id> <label>" && echo "  Example: /label-session 7ee51d83-6cdd-444e-a074-865dee92bd18 \"Fix auth bug\"" && echo "" && echo "To see all sessions:" && echo "  /list-sessions" && echo ""
```

## Output Format

The command will display sessions like this:

```
=== Claude Code Sessions (Most Recent First) ===

Session: 7ee51d83-6cdd-444e-a074-865dee92bd18
  Label: Developer utilities plugin work
  Project: /home/adam/Code/claude-code
  Started: 2025-11-16 15:37
  Last Activity: 2025-11-16 15:45
  Interactions: 24
  First Message: Is there a way to fix this? would this be a good ca...

Session: fccea55b-62b9-447d-ac21-76c04e32aece
  Project: /home/adam/Code/claude-code
  Started: 2025-11-15 16:22
  Last Activity: 2025-11-15 17:10
  Interactions: 18
  First Message: Review the developer-utilities plugin...
```

## Related Commands

- `/label-session` - Add or update a label for a session
- `/resume` - Resume a previous session (built-in Claude Code command)
- `claude --resume` - Resume from CLI

## Notes

- Sessions are identified by UUID (e.g., `7ee51d83-6cdd-444e-a074-865dee92bd18`)
- Labels are optional and stored in `~/.claude/session-labels.json`
- Timestamps are converted from milliseconds to human-readable format
- The first non-command message is shown for context
- Limited to 20 most recent sessions for readability

## Troubleshooting

If sessions don't appear:
- Check `~/.claude/history.jsonl` exists
- Verify `jq` is installed: `which jq`
- Check file permissions: `ls -la ~/.claude/history.jsonl`

## References

- GitHub Issue: #3605 - Session renaming feature request
- Related: This addresses the "better session visualization" request
