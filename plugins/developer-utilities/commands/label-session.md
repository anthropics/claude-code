---
description: Add or update a user-friendly label for a Claude Code session
---

## Your Task

**Extract** the session ID and label from the user's request, then **store** it in `~/.claude/session-labels.json` for use with `/list-sessions`.

**IMPORTANT:**
- Session ID must be a valid UUID format (e.g., `7ee51d83-6cdd-444e-a074-865dee92bd18`)
- Label should be descriptive and brief (e.g., "Fix auth bug", "Refactor API")
- Creates `~/.claude/session-labels.json` if it doesn't exist
- Updates existing labels without losing other session data

## Context

Issue #3605 requests session renaming functionality. Since Claude Code stores session metadata in a database that we cannot safely modify, this command provides a **workaround** by maintaining a separate labels file.

**How it works:**
1. User provides: `/label-session <session-id> <label>`
2. Command stores mapping in `~/.claude/session-labels.json`
3. `/list-sessions` reads and displays these labels
4. Non-destructive: doesn't modify Claude Code's internal database

**File format** (`~/.claude/session-labels.json`):
```json
{
  "session-id-here": {
    "label": "User-friendly name",
    "created": "2025-11-16T15:45:00Z",
    "updated": "2025-11-16T16:20:00Z"
  }
}
```

## Usage Examples

```bash
# Label the current session
/label-session 7ee51d83-6cdd-444e-a074-865dee92bd18 "Developer utilities plugin"

# Update an existing label
/label-session fccea55b-62b9-447d-ac21-76c04e32aece "Fix auth bug - completed"

# Use quotes for multi-word labels
/label-session abc-123 "Refactor authentication system"
```

## Commands to Execute

### Step 1: Parse user input

Extract session ID and label from the user's message. The user should provide:
- Session ID (36 character UUID)
- Label (remaining text after session ID)

**Ask the user** to provide these if not already given:

```
Please provide the session ID and label in this format:
/label-session <session-id> <label>

Example:
/label-session 7ee51d83-6cdd-444e-a074-865dee92bd18 "Working on auth system"

To find your session ID, use /list-sessions
```

### Step 2: Validate session ID format

Once you have the session ID, validate it's a proper UUID:

```bash
SESSION_ID="<user-provided-session-id>" && if echo "$SESSION_ID" | grep -E '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' >/dev/null 2>&1; then echo "Valid session ID: $SESSION_ID"; else echo "ERROR: Invalid session ID format. Must be a UUID like: 7ee51d83-6cdd-444e-a074-865dee92bd18"; exit 1; fi
```

### Step 3: Verify session exists in history

Check if the session ID exists in history.jsonl:

```bash
SESSION_ID="<user-provided-session-id>" && if grep -q "\"sessionId\":\"$SESSION_ID\"" ~/.claude/history.jsonl 2>/dev/null; then echo "Session found in history"; else echo "WARNING: Session ID not found in ~/.claude/history.jsonl. The label will be saved but may not correspond to an active session."; fi
```

### Step 4: Create or update labels file

Create the labels file if it doesn't exist, or update it with the new label:

```bash
LABELS_FILE=~/.claude/session-labels.json && SESSION_ID="<user-provided-session-id>" && LABEL="<user-provided-label>" && TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ") && if [ ! -f "$LABELS_FILE" ]; then echo '{}' > "$LABELS_FILE" && echo "Created new labels file: $LABELS_FILE"; fi && EXISTING_CREATED=$(jq -r --arg sid "$SESSION_ID" '.[$sid].created // ""' "$LABELS_FILE" 2>/dev/null) && if [ -z "$EXISTING_CREATED" ]; then CREATED="$TIMESTAMP"; else CREATED="$EXISTING_CREATED"; fi && jq --arg sid "$SESSION_ID" --arg label "$LABEL" --arg created "$CREATED" --arg updated "$TIMESTAMP" '.[$sid] = {label: $label, created: $created, updated: $updated}' "$LABELS_FILE" > "$LABELS_FILE.tmp" && mv "$LABELS_FILE.tmp" "$LABELS_FILE" && echo "" && echo "✓ Session labeled successfully!" && echo "" && echo "Session ID: $SESSION_ID" && echo "Label: $LABEL" && echo "Updated: $TIMESTAMP" && echo "" && echo "Use /list-sessions to see your labeled sessions."
```

### Step 5: Show the updated label

Display the newly created or updated label:

```bash
LABELS_FILE=~/.claude/session-labels.json && SESSION_ID="<user-provided-session-id>" && if [ -f "$LABELS_FILE" ]; then echo "=== Session Label ===" && jq --arg sid "$SESSION_ID" '.[$sid]' "$LABELS_FILE"; else echo "Labels file not found"; fi
```

## What to Ask the User

If the user runs `/label-session` without providing both session ID and label, ask:

```
I need two pieces of information to label a session:

1. **Session ID** - The UUID of the session to label
2. **Label** - A descriptive name for this session

Format:
/label-session <session-id> <label>

Example:
/label-session 7ee51d83-6cdd-444e-a074-865dee92bd18 "Developer utilities plugin work"

---

To find available session IDs, run: /list-sessions

What session would you like to label?
```

## Expected User Response

The user should provide:

```
/label-session 7ee51d83-6cdd-444e-a074-865dee92bd18 "Working on authentication bug"
```

Or they can provide the information conversationally:

```
Label session 7ee51d83-6cdd-444e-a074-865dee92bd18 as "API refactoring"
```

## Example Output

After successfully labeling a session:

```
✓ Session labeled successfully!

Session ID: 7ee51d83-6cdd-444e-a074-865dee92bd18
Label: Developer utilities plugin work
Updated: 2025-11-16T20:45:32Z

Use /list-sessions to see your labeled sessions.
```

## Related Commands

- `/list-sessions` - View all sessions with their labels
- `/resume` - Resume a previous session (built-in)

## Advanced Usage

### Label the current session

To label the session you're currently in, first find its ID:

```bash
cat ~/.claude/history.jsonl | jq -r '.sessionId' | tail -1
```

Then use that ID with `/label-session`.

### Remove a label

To remove a label, set it to an empty string:

```
/label-session abc-123 ""
```

Or manually edit `~/.claude/session-labels.json` and remove the entry.

### Bulk labeling

To label multiple sessions at once, manually edit `~/.claude/session-labels.json`:

```json
{
  "session-1": {
    "label": "Auth system work",
    "created": "2025-11-16T20:00:00Z",
    "updated": "2025-11-16T20:00:00Z"
  },
  "session-2": {
    "label": "API refactoring",
    "created": "2025-11-16T20:01:00Z",
    "updated": "2025-11-16T20:01:00Z"
  }
}
```

## Troubleshooting

**"Invalid session ID format"**
- Session IDs must be UUIDs (36 characters with hyphens)
- Get session IDs from `/list-sessions`

**"Session ID not found in history"**
- The session may be very old or from a different system
- The label will still be saved but may not be useful

**"jq: command not found"**
- Install jq: `sudo apt install jq` (Ubuntu) or `brew install jq` (macOS)

**Labels not showing in /list-sessions**
- Verify `~/.claude/session-labels.json` exists and has valid JSON
- Check file permissions: `ls -la ~/.claude/session-labels.json`

## References

- GitHub Issue: #3605 - Session renaming feature request
- Note: This is a **workaround** since we cannot modify Claude Code's internal session database
