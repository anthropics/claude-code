---
description: Send a query to OpenAI Codex with intelligent session routing
argument-hint: your question
allowed-tools: Bash, Read, Write, AskUserQuestion
---

## Your task

Execute the user's query with Codex using intelligent session routing. Return ONLY the final result.

### CRITICAL: User wants ONLY final results - NO verbose output

- ❌ NO process steps ("Checking...", "Routing...", "Creating session...")
- ❌ NO session IDs, file lists, or metadata
- ✅ ONLY return Codex's final response
- ✅ All session management happens SILENTLY

### Workflow (ALL SILENT - user sees nothing until final response)

**Step 1: Check Authentication**

```bash
codex login status 2>&1 | grep -q "Logged in"
if [ $? -ne 0 ]; then
  echo "Error: Not authenticated. Run /codex:login"
  exit 1
fi
```

**Step 2: Initialize Registry**

```bash
if [ ! -f ~/.codex/claude-sessions.json ]; then
  echo '{"version":"1.0.0","sessions":[]}' > ~/.codex/claude-sessions.json
fi
```

**Step 3: Extract Keywords from Query**

```bash
# Extract 4+ character words as keywords
QUERY="<user_query>"
KEYWORDS=$(echo "$QUERY" | tr '[:upper:]' '[:lower:]' | grep -oE '\b[a-z]{4,}\b' | head -5)
```

**Step 4: Match Existing Session**

```bash
# Check for continuation words
if echo "$QUERY" | grep -qiE '\b(also|continue|keep|additionally|furthermore)\b'; then
  # Use last session
  SESSION_ID=$(cat ~/.codex/claude-sessions.json | jq -r '.sessions | sort_by(.last_used) | reverse | .[0].id // empty')
  if [ -n "$SESSION_ID" ]; then
    USE_RESUME=true
  fi
else
  # Match by keywords
  BEST_SESSION=""
  BEST_SCORE=0

  for SESSION_ID in $(cat ~/.codex/claude-sessions.json | jq -r '.sessions[] | select(.status == "active") | .id'); do
    SESSION_KEYWORDS=$(cat ~/.codex/claude-sessions.json | jq -r --arg id "$SESSION_ID" '.sessions[] | select(.id == $id) | .keywords[]')
    MATCH_COUNT=0
    for KW in $KEYWORDS; do
      if echo "$SESSION_KEYWORDS" | grep -q "$KW"; then
        MATCH_COUNT=$((MATCH_COUNT + 1))
      fi
    done

    # Calculate match percentage
    QUERY_KW_COUNT=$(echo "$KEYWORDS" | wc -w)
    if [ $QUERY_KW_COUNT -gt 0 ]; then
      SCORE=$((MATCH_COUNT * 100 / QUERY_KW_COUNT))
      if [ $SCORE -gt 50 ] && [ $SCORE -gt $BEST_SCORE ]; then
        BEST_SESSION="$SESSION_ID"
        BEST_SCORE=$SCORE
      fi
    fi
  done

  if [ -n "$BEST_SESSION" ]; then
    SESSION_ID="$BEST_SESSION"
    USE_RESUME=true
  fi
fi
```

**Step 5: Execute Codex**

```bash
# Create temp file for output
OUTPUT_FILE="/tmp/codex-output-$$.jsonl"

if [ "$USE_RESUME" = "true" ] && [ -n "$SESSION_ID" ]; then
  # Resume existing session
  codex resume "$SESSION_ID" --json "$QUERY" > "$OUTPUT_FILE" 2>&1
else
  # Create new session
  codex exec --json "$QUERY" > "$OUTPUT_FILE" 2>&1
  # Extract new session ID
  SESSION_ID=$(head -1 "$OUTPUT_FILE" | jq -r '.thread_id // .session_id // empty')
fi
```

**Step 6: Handle Approvals (ONLY time user sees interaction)**

```bash
# Check for approval requests
if grep -q '"type":"approval_request"' "$OUTPUT_FILE"; then
  APPROVAL_ACTION=$(grep '"type":"approval_request"' "$OUTPUT_FILE" | jq -r '.action')
  APPROVAL_PATH=$(grep '"type":"approval_request"' "$OUTPUT_FILE" | jq -r '.path')
  APPROVAL_PREVIEW=$(grep '"type":"approval_request"' "$OUTPUT_FILE" | jq -r '.preview // .diff' | head -c 500)

  # Use AskUserQuestion for approval
  # (Tool invocation would go here)
fi
```

**Step 7: Update Registry (SILENT)**

```bash
if [ -n "$SESSION_ID" ]; then
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Check if session exists in registry
  if cat ~/.codex/claude-sessions.json | jq -e --arg id "$SESSION_ID" '.sessions[] | select(.id == $id)' > /dev/null 2>&1; then
    # Update existing session
    rm -f ~/.codex/claude-sessions.json.tmp
    jq --arg id "$SESSION_ID" --arg ts "$TIMESTAMP" \
      '(.sessions[] | select(.id == $id) | .last_used) = $ts' \
      ~/.codex/claude-sessions.json > ~/.codex/claude-sessions.json.tmp && \
      mv ~/.codex/claude-sessions.json.tmp ~/.codex/claude-sessions.json
  else
    # Add new session
    TASK_SUMMARY=$(echo "$QUERY" | head -c 100)
    KEYWORDS_JSON=$(echo "$KEYWORDS" | jq -R . | jq -s .)

    rm -f ~/.codex/claude-sessions.json.tmp
    jq --arg id "$SESSION_ID" \
       --arg task "$TASK_SUMMARY" \
       --argjson kw "$KEYWORDS_JSON" \
       --arg ts "$TIMESTAMP" \
       '.sessions += [{
         "id": $id,
         "task_summary": $task,
         "keywords": $kw,
         "last_used": $ts,
         "status": "active"
       }]' \
       ~/.codex/claude-sessions.json > ~/.codex/claude-sessions.json.tmp && \
       mv ~/.codex/claude-sessions.json.tmp ~/.codex/claude-sessions.json
  fi
fi
```

**Step 8: Extract and Return ONLY Final Response**

```bash
# Get final response from turn.completed event
FINAL_RESPONSE=$(grep '"type":"turn.completed"' "$OUTPUT_FILE" | jq -r '.summary // .message')

# If no turn.completed, get last assistant message
if [ -z "$FINAL_RESPONSE" ]; then
  FINAL_RESPONSE=$(grep '"type":"item.agent_message"' "$OUTPUT_FILE" | tail -1 | jq -r '.content')
fi

# Cleanup temp file
rm -f "$OUTPUT_FILE"

# Output ONLY the response
echo "$FINAL_RESPONSE"
```

### Return Format

**Success - User sees:**
```
{codex_response_only}
```

**Error - User sees:**
```
Error: {brief_reason}
```

### Important

- ALL session management logic executes silently
- User ONLY sees Codex's final response
- NO commentary, NO explanations, NO metadata
