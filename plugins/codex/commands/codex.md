---
description: Send a query to OpenAI Codex
argument-hint: your question
allowed-tools: Bash
---

## Your task

Send the user's query directly to OpenAI Codex using the CLI.

### CLI Path
```
${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py
```

### Step 1: Check Authentication

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" status
```

If not authenticated (check `auth.authenticated` in JSON response), tell user to run `/codex:login` first.

### Step 2: Check for Session Continuity

Analyze the query to determine if it's a follow-up:

**Continue existing session if:**
- Query references "it", "that", "the code", etc.
- User says "also", "continue", "what about..."
- Same topic as recent session

If continuing, get sessions:
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" sessions
```

**Start new session if:**
- Standalone question
- Different topic
- User explicitly says "new question"

### Step 3: Execute Query

**For new session:**
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" query "<user_prompt>" --save-session
```

**For existing session:**
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/cli/codex_cli.py" query "<user_prompt>" --session "<session_id>"
```

### Step 4: Return Response

Parse the JSON response and display:

```
{response}

---
Session: {session_id} | Model: {model}
```

### Important

- **DO NOT ask permission questions** for simple queries
- Just execute the query and return the response
- The CLI outputs JSON - parse and display nicely
