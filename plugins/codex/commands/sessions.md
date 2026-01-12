---
description: Manage Codex sessions with intelligent routing table
argument-hint: [list|show <id>|cleanup|build]
allowed-tools: Bash, Read, Write
---

## Your task

Manage Codex sessions using the session registry routing table.

**CRITICAL: User wants clean output, NO verbose processing steps**

### Registry Path
```
~/.codex/claude-sessions.json
```

### Workflow

**Step 1: Initialize Registry if Missing**

```bash
if [ ! -f ~/.codex/claude-sessions.json ]; then
  echo '{"version":"1.0.0","sessions":[]}' > ~/.codex/claude-sessions.json

  # Auto-build from existing Codex CLI sessions
  if [ -d ~/.codex/sessions ]; then
    SESSIONS=$(find ~/.codex/sessions -name "rollout-*.jsonl" 2>/dev/null | sort -r | head -20)

    for SESSION_FILE in $SESSIONS; do
      BASENAME=$(basename "$SESSION_FILE")
      SESSION_ID=$(echo "$BASENAME" | sed -E 's/rollout-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-(.+)\.jsonl/\1/')

      LAST_USED=$(date -r "$SESSION_FILE" -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "2026-01-01T00:00:00Z")

      # Extract first user message text from JSONL
      TASK_SUMMARY=$(grep -m1 '"role":"user"' "$SESSION_FILE" | jq -r '.payload.content[0].text // .payload.content[0].input_text // empty' 2>/dev/null | head -c 80 || echo "Codex session")

      if [ -z "$TASK_SUMMARY" ] || [ "$TASK_SUMMARY" = "null" ]; then
        TASK_SUMMARY="Codex session"
      fi

      # Extract keywords (4+ char words)
      KEYWORDS=$(echo "$TASK_SUMMARY" | tr '[:upper:]' '[:lower:]' | grep -oE '\b[a-z]{4,}\b' | head -5 | jq -R . | jq -s . 2>/dev/null || echo '[]')

      # Add to registry
      rm -f ~/.codex/claude-sessions.json.tmp
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
         ~/.codex/claude-sessions.json > ~/.codex/claude-sessions.json.tmp 2>/dev/null && \
         mv ~/.codex/claude-sessions.json.tmp ~/.codex/claude-sessions.json
    done
  fi
fi
```

**Step 2: Handle User Action**

Parse argument (default: list):

```bash
ACTION="${1:-list}"
```

**Action: list**

```bash
# Count sessions
TOTAL=$(cat ~/.codex/claude-sessions.json | jq '.sessions | length')
ACTIVE=$(cat ~/.codex/claude-sessions.json | jq '[.sessions[] | select(.status == "active")] | length')

echo "## Codex Sessions ($TOTAL total, $ACTIVE active)"
echo ""

# Group by date
cat ~/.codex/claude-sessions.json | jq -r '.sessions[] | "[\(.status)] \(.id[0:8])... - \(.task_summary) (Last: \(.last_used[0:10]))"' | head -20

echo ""
echo "Use /codex:sessions show <id> for details"
```

**Action: show <id>**

```bash
SESSION_ID="$2"
cat ~/.codex/claude-sessions.json | jq --arg id "$SESSION_ID" '.sessions[] | select(.id == $id or (.id | startswith($id)))'

# Show resumption command
echo ""
echo "Resume: codex resume $SESSION_ID"
```

**Action: cleanup**

```bash
# Archive non-active sessions
rm -f ~/.codex/claude-sessions.json.tmp
jq '.sessions |= map(if (.status == "completed" or .status == "failed") then .status = "archived" else . end)' \
  ~/.codex/claude-sessions.json > ~/.codex/claude-sessions.json.tmp && \
  mv ~/.codex/claude-sessions.json.tmp ~/.codex/claude-sessions.json

echo "✓ Sessions cleaned up"
```

**Action: build**

```bash
# Rebuild entire registry
cat > ~/.codex/claude-sessions.json <<'EOF'
{"version":"1.0.0","sessions":[]}
EOF

SESSIONS=$(find ~/.codex/sessions -name "rollout-*.jsonl" 2>/dev/null | sort -r | head -50)
COUNT=0

for SESSION_FILE in $SESSIONS; do
  BASENAME=$(basename "$SESSION_FILE")
  SESSION_ID=$(echo "$BASENAME" | sed -E 's/rollout-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-(.+)\.jsonl/\1/')

  LAST_USED=$(date -r "$SESSION_FILE" -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "2026-01-01T00:00:00Z")

  # Extract first user message
  TASK_SUMMARY=$(grep -m1 '"role":"user"' "$SESSION_FILE" | jq -r '.payload.content[0].text // .payload.content[0].input_text // empty' 2>/dev/null | head -c 80 || echo "Codex session")

  if [ -z "$TASK_SUMMARY" ] || [ "$TASK_SUMMARY" = "null" ]; then
    TASK_SUMMARY="Codex session"
  fi

  KEYWORDS=$(echo "$TASK_SUMMARY" | tr '[:upper:]' '[:lower:]' | grep -oE '\b[a-z]{4,}\b' | head -5 | jq -R . | jq -s . 2>/dev/null || echo '[]')

  rm -f ~/.codex/claude-sessions.json.tmp
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
     ~/.codex/claude-sessions.json > ~/.codex/claude-sessions.json.tmp 2>/dev/null && \
     mv ~/.codex/claude-sessions.json.tmp ~/.codex/claude-sessions.json

  COUNT=$((COUNT + 1))
done

echo "✓ Built routing table with $COUNT sessions"
```

### Output Examples

**list:**
```
## Codex Sessions (16 total, 16 active)

[active] 019bb30a... - help with authentication (Last: 2026-01-13)
[active] 019bb2ff... - hello (Last: 2026-01-13)
[active] 019baf47... - fix the login bug (Last: 2026-01-12)
...

Use /codex:sessions show <id> for details
```

**show <id>:**
```json
{
  "id": "019bb2ff-f78f-7321-aada-c464b781be5d",
  "task_summary": "hello",
  "keywords": ["hello"],
  "last_used": "2026-01-13T00:17:58Z",
  "status": "active"
}

Resume: codex resume 019bb2ff-f78f-7321-aada-c464b781be5d
```

**cleanup:**
```
✓ Sessions cleaned up
```

**build:**
```
✓ Built routing table with 50 sessions
```

### Important Notes

- **Routing table** enables intelligent session matching for /codex queries
- **Auto-initialized** on first use from existing Codex CLI sessions
- **Keywords** extracted from first user message for smart routing
- Use `build` to manually rebuild from all sessions
