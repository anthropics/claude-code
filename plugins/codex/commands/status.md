---
description: Show Codex status, configuration, and usage
allowed-tools: Bash, Read
---

## Your task

Display comprehensive OpenAI Codex CLI status including authentication, configuration, and usage statistics.

### Step 1: Check Authentication Status

```bash
codex login status 2>&1
```

### Step 2: Check CLI Version and Location

```bash
codex --version 2>&1
which codex 2>&1
```

### Step 3: Get Current Configuration

Read the configuration file if it exists:

```bash
if [ -f ~/.codex/config.toml ]; then
  cat ~/.codex/config.toml
else
  echo "No config file found (using defaults)"
fi
```

### Step 4: Query Usage Statistics

Get usage information from Codex:

```bash
# Try to get usage stats from Codex CLI
codex usage 2>&1
```

Or check if there's a usage log:

```bash
# Check for usage logs
if [ -f ~/.codex/usage.json ]; then
  cat ~/.codex/usage.json | jq '.'
fi
```

Or query OpenAI API usage directly:

```bash
# Get current month's usage (if API key available)
curl -s https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"date\": \"$(date +%Y-%m)\"}" 2>&1 | jq '.'
```

### Step 5: Check Session History

Get recent session information:

```bash
# List recent Codex sessions
ls -lt ~/.codex/threads/ 2>/dev/null | head -10
```

Count total sessions:

```bash
# Count total sessions
TOTAL_SESSIONS=$(ls ~/.codex/threads/ 2>/dev/null | wc -l)
echo "Total sessions: $TOTAL_SESSIONS"
```

### Display Format

Present the information in this structured format:

```
## Codex Status

### Authentication
- Status: ✓ Logged in with {method} / ✗ Not authenticated
- Credentials: Stored in ~/.codex/auth.json
- API Key: {masked} (if using API key)

### CLI Installation
- Version: codex-cli {version}
- Location: {path}
- Status: ✓ Installed and available

### Current Configuration
- Model: {configured_model} (default: gpt-4o)
- Reasoning Effort: {effort_level} (if configured)
- Provider: {provider} (default: openai)
- Approval Mode: {approval_mode} (default: suggest)
- Config File: ~/.codex/config.toml

### Usage Statistics
- Token Usage (Current Month):
  - Prompt Tokens: {prompt_tokens}
  - Completion Tokens: {completion_tokens}
  - Total Tokens: {total_tokens}
- Estimated Cost: ${cost}
- Total Sessions: {session_count}
- Active Sessions: {active_count}

### Session Management
- Session Registry: ~/.codex/claude-sessions.json
- Thread Storage: ~/.codex/threads/
- Recent Sessions: {list_recent_3}

### Available Commands
- /codex - Send queries to Codex
- /codex:model - Select model and reasoning effort
- /codex:sessions - Manage conversation sessions
- /codex:login - Configure authentication
- /codex:logout - Remove authentication
- /codex:compare - Compare Claude and Codex responses
- /codex:review - Request code reviews
```

### Important Notes

- Usage statistics require active OpenAI API access
- Token counts and costs are estimates based on API responses
- Session data persists across Claude Code restarts
- Run `/codex:login` if authentication is needed
