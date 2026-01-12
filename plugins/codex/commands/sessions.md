---
description: Manage Codex sessions with intelligent routing table
argument-hint: [list|show <id>|cleanup|build]
allowed-tools: Bash, Read, Write, AskUserQuestion
---

## Your task

Manage Codex sessions using the session registry routing table.

### Session Registry Path
```
~/.codex/claude-sessions.json
```

### Step 1: Check Registry Status

```bash
if [ -f ~/.codex/claude-sessions.json ]; then
  echo "REGISTRY_EXISTS"
else
  echo "REGISTRY_MISSING"
fi
```

### Step 2: Handle Based on Action

**If registry is MISSING:**

Build it from existing Codex CLI sessions. Skip asking, just build automatically.

**Action: list (default)**

Display all tracked sessions from registry:

```bash
if [ -f ~/.codex/claude-sessions.json ]; then
  cat ~/.codex/claude-sessions.json | jq -r '.sessions[] | "[\(.status)] \(.id[0:8])... - \(.task_summary) (Last used: \(.last_used))"'
else
  echo "Building registry from existing sessions..."
fi
```

**Action: show <id>**

Show detailed information about a specific session:

```bash
SESSION_ID="<user_provided_id>"
if [ -f ~/.codex/claude-sessions.json ]; then
  cat ~/.codex/claude-sessions.json | jq --arg id "$SESSION_ID" '.sessions[] | select(.id == $id or (.id | startswith($id)))'
else
  echo "Registry not found. Run /codex:sessions build"
fi
```

**Action: cleanup**

Remove old or inactive sessions from registry:

```bash
if [ -f ~/.codex/claude-sessions.json ]; then
  # Show sessions marked for cleanup
  echo "Sessions eligible for cleanup:"
  cat ~/.codex/claude-sessions.json | jq -r '.sessions[] | select(.status != "active") | "[\(.status)] \(.id[0:8])... - \(.task_summary)"'

  # Archive old sessions
  rm -f ~/.codex/claude-sessions.json.tmp
  jq '.sessions |= map(if (.status == "completed" or .status == "failed") then .status = "archived" else . end)' \
    ~/.codex/claude-sessions.json > ~/.codex/claude-sessions.json.tmp && \
    mv ~/.codex/claude-sessions.json.tmp ~/.codex/claude-sessions.json

  echo "Sessions archived. Registry updated."
else
  echo "No registry to cleanup"
fi
```

**Action: build**

Build or rebuild the routing table from existing Codex CLI sessions:

### Step 3: Build Routing Table

When registry is missing or user runs `build`, scan existing Codex CLI sessions and create routing table:

```bash
# Initialize registry structure
cat > ~/.codex/claude-sessions.json <<'EOF'
{
  "version": "1.0.0",
  "sessions": []
}
EOF

# Find all Codex CLI session rollout files
SESSIONS=$(find ~/.codex/sessions -name "rollout-*.jsonl" 2>/dev/null | sort -r | head -50)

# Process each session
for SESSION_FILE in $SESSIONS; do
  # Extract session ID from filename
  BASENAME=$(basename "$SESSION_FILE")
  SESSION_ID=$(echo "$BASENAME" | sed -E 's/rollout-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-(.+)\.jsonl/\1/')

  # Get last modification time as last_used
  LAST_USED=$(date -r "$SESSION_FILE" -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || stat -f "%Sm" -t "%Y-%m-%dT%H:%M:%SZ" "$SESSION_FILE" 2>/dev/null)

  # Try to extract task summary from first user message in rollout
  TASK_SUMMARY=$(head -20 "$SESSION_FILE" | grep '"type":"user_message"' | head -1 | jq -r '.content // .text' 2>/dev/null | head -c 100)

  # If no task summary found, use generic description
  if [ -z "$TASK_SUMMARY" ]; then
    TASK_SUMMARY="Codex session"
  fi

  # Extract keywords from task summary (simple word extraction)
  KEYWORDS=$(echo "$TASK_SUMMARY" | tr '[:upper:]' '[:lower:]' | grep -oE '\b[a-z]{4,}\b' | head -5 | jq -R . | jq -s .)

  # Add to registry
  jq --arg id "$SESSION_ID" \
     --arg task "$TASK_SUMMARY" \
     --argjson kw "$KEYWORDS" \
     --arg ts "$LAST_USED" \
     '.sessions += [{
       "id": $id,
       "task_summary": $task,
       "keywords": $kw,
       "last_used": $ts,
       "status": "active"
     }]' \
     ~/.codex/claude-sessions.json > ~/.codex/claude-sessions.json.tmp && \
     mv ~/.codex/claude-sessions.json.tmp ~/.codex/claude-sessions.json
done

echo "Built routing table with $(cat ~/.codex/claude-sessions.json | jq '.sessions | length') sessions"
```

### Output Format

**For list (with registry):**
```
## Codex Sessions Routing Table

Active Sessions:
[active] abc12345... - Implement authentication flow (Last used: 2026-01-12T10:30:00Z)
[active] def67890... - Database optimization (Last used: 2026-01-12T09:15:00Z)

Archived Sessions:
[archived] ghi11111... - Bug fix task (Last used: 2026-01-10T14:20:00Z)

Total: 3 sessions (2 active, 1 archived)

Use /codex:sessions show <id> for details
```

**For build:**
```
## Building Codex Sessions Routing Table

Scanning ~/.codex/sessions/ for existing sessions...
Found 15 Codex CLI sessions

Processing sessions and extracting task context...
- Session 019bb2ff... - Task: "help with authentication" - Keywords: [auth, help, authentication]
- Session 019baf47... - Task: "fix the bug in login" - Keywords: [fix, bug, login]
...

✓ Built routing table with 15 sessions
✓ Registry saved to: ~/.codex/claude-sessions.json

The routing table enables intelligent session matching. When you run /codex with a query, it will automatically:
1. Extract keywords from your query
2. Match against existing sessions
3. Resume the most relevant session (>50% keyword match)
4. Or create a new session if no match found
```

### Important Notes

- **Routing table** tracks task context for intelligent session matching
- **Automatic initialization** - Registry is built on first use if missing
- **Keywords** enable smart session routing (e.g., "auth" query → resume "authentication" session)
- **Codex CLI sessions** are stored separately in ~/.codex/sessions/
- To manually rebuild routing table: `/codex:sessions build`
