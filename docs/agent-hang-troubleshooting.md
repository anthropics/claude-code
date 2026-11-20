# Agent Hang & Infinite Loop Troubleshooting Guide

> **Last updated:** 2026-03-02
> **Tracks issues:** #30014, #7122, #4002, #4744, #16752, #26346, #13315 and related

## Overview

This guide covers the cluster of issues where Claude Code agents — particularly the **Explore agent** — enter an infinite loop, freeze, or hang indefinitely. The most common trigger is a `MaxFileReadTokenExceededError` that the agent fails to recover from gracefully.

---

## How the Infinite Loop Happens

The typical failure chain:

```
1. Explore agent attempts to read a large file
2. File exceeds 25,000 token limit
3. MaxFileReadTokenExceededError is thrown
4. Agent receives error message: "use offset and limit parameters"
5. Agent retries the SAME read without adjusting offset/limit
6. Steps 3-5 repeat indefinitely (no retry cap, no backoff)
7. Eventually: either token budget exhausted, network abort, or secondary hang
```

From issue #30014 — actual error log showing the loop:
```json
{"error":"MaxFileReadTokenExceededError: File content (41049 tokens) exceeds maximum allowed tokens (25000).","timestamp":"2026-03-02T07:43:32.583Z"}
{"error":"MaxFileReadTokenExceededError: File content (41049 tokens) exceeds maximum allowed tokens (25000).","timestamp":"2026-03-02T07:43:38.568Z"}
{"error":"Error: Request was aborted.","timestamp":"2026-03-02T07:54:22.583Z"}
```

Note: same error fired twice in 6 seconds (07:43:32 and 07:43:38) — then 11 minutes later, `Request was aborted` as the session died.

---

## Hang Scenario 1: Standard Infinite Loop

**Symptoms:** Agent keeps running, token counter climbs steadily, no progress

**Cause:** `MaxFileReadTokenExceededError` retry loop as described above

**Immediate fix:**
- Press `Esc` to interrupt the agent
- If Esc doesn't work: `Ctrl+C` to kill the process
- Resume with `claude --resume` to restore context

---

## Hang Scenario 2: Stuck at Low Tokens (Secondary Hang)

**Symptoms:** Token counter shows very low per-turn usage (e.g., `1m 23s · ↓ 618 tokens`), agent appears active but never completes a step

**Cause:** After `MaxFileReadTokenExceededError`, the agent enters a secondary hang state — a tight tool-call loop where:
- Each turn consumes only ~50-100 tokens (just enough to invoke a tool)
- The tool returns an error or empty result
- The model re-tries the same tool with no strategy change
- No max-retry cap exists on tool calls within a single turn sequence

This is **distinct** from the standard infinite loop — the token rate is low, not high.

**Step-by-step fix:**

### Step 1: Force-kill the stuck process
```bash
# In a NEW terminal window:
ps aux | grep claude
kill -9 <PID>  # replace with actual process ID
```

### Step 2: Clear the session state
```bash
# Remove partial session cache:
rm -rf ~/.claude/projects/*/session_*.json 2>/dev/null
```

### Step 3: Add `.claudeignore` BEFORE restarting
```bash
cat > .claudeignore << 'EOF'
# Exclude large files that cause MaxFileReadTokenExceededError
node_modules/
dist/
build/
*.min.js
*.bundle.js
*.lock
package-lock.json
yarn.lock
*.log
*.map
coverage/
.next/
__pycache__/
*.pyc
EOF
```

### Step 4: Restart with turn limit
```bash
claude --max-turns 20
```

### Step 5: Use `/compact` as early intervention
As soon as you see the token counter stalling (very low tokens per step), type `/compact` in the Claude session. Context compaction often breaks the loop without requiring a full kill.

---

## Hang Scenario 3: Keyboard Input Frozen

**Symptoms:** Can't type in terminal, Esc/Ctrl+C unresponsive, terminal appears completely locked

**Cause:** The agent has taken over stdin, blocking keyboard input (related: #4744)

**Fix:**
```bash
# From another terminal:
kill -SIGTERM $(pgrep -f claude)
# If that fails:
kill -9 $(pgrep -f claude)
```

For Ghostty terminal users specifically: Ghostty may not propagate Esc to the Claude process under certain conditions. Use `kill` from a separate pane/window.

---

## Prevention Strategies

### 1. Add `.claudeignore` to all projects
Prevents the Explore agent from attempting to read large generated files:
```
node_modules/
dist/
build/
*.lock
*.log
*.map
*.min.js
```

### 2. Use `--max-turns` flag
```bash
claude --max-turns 30  # stops after 30 agent turns
```

### 3. Guide Claude to use GrepTool instead of full file reads
For large codebases, explicitly instruct Claude:
```
"Use grep to search for [pattern] instead of reading the whole file"
"Search for the function definition using grep, don't read the entire file"
```

### 4. Use offset/limit for large files
If you need Claude to read a large file:
```
"Read the first 200 lines of large-file.ts using offset=0, limit=200"
```

### 5. Run in Explore mode with file size awareness
Before starting an Explore session on a large codebase, check for large files:
```bash
find . -name '*.ts' -o -name '*.js' | xargs wc -l 2>/dev/null | sort -rn | head -20
```
Any file over ~1000 lines may exceed the token limit and should be added to `.claudeignore` or explicitly guided with offset/limit.

---

## Root Cause & Required Code Fixes

The core issue requires code-level fixes in the Explore agent's tool dispatch layer:

### Fix 1: Retry cap on MaxFileReadTokenExceededError
```
When MaxFileReadTokenExceededError is thrown:
- Attempt 1: retry with offset=0, limit=200
- Attempt 2: retry with offset=0, limit=100  
- Attempt 3: skip file, log warning to user: "Skipping [filename]: too large to read in chunks"
- Never attempt more than 3 times on the same file
```

### Fix 2: User-visible warning on first token error
Currently the agent retries silently. It should surface:
```
Warning: [filename] is too large to read in full (41049 tokens > 25000 limit).
Switching to chunked reading with offset/limit...
```

### Fix 3: Exponential backoff between retries
Add a delay between retry attempts to prevent tight loops from overwhelming the API.

### Fix 4: Secondary hang detection
If consecutive turns each use fewer than 200 tokens with no tool success, trigger a user prompt:
```
Agent appears stuck (low token usage, no progress for N turns).
Options: [C]ontinue / [S]kip current task / [A]bort
```

---

## Related Issues

| Issue | Description |
|-------|-------------|
| #4002 | File content exceeds maximum allowed tokens |
| #4744 | Agent hangs indefinitely, no recovery path without Esc |
| #7122 | Explore agent hangs on large repo |
| #13315 | Infinite loop with empty Bash consuming tokens |
| #16752 | Infinite retry loop with high API traffic |
| #26346 | Context compaction fails when agent reaches context limit |
| #30014 | Explore agent infinite loop / hang condition (MaxFileReadTokenExceededError) |

---

## Quick Reference: Which Scenario Am I In?

| Symptom | Scenario | Fix |
|---------|----------|-----|
| Tokens climbing fast, no progress | Scenario 1 (standard loop) | Esc → Ctrl+C → restart |
| Very low tokens per turn, stuck | Scenario 2 (secondary hang) | kill PID, clear session, add .claudeignore |
| Keyboard completely frozen | Scenario 3 (stdin locked) | kill from separate terminal |
| Stuck for >10 min with no output | Any | kill -9, check .claudeignore, use --max-turns |
