# Debugging Codex OAuth Plugin

This guide helps troubleshoot issues with the OpenAI Codex OAuth integration plugin.

## MCP Server Configuration

The Codex plugin uses a Python-based MCP (Model Context Protocol) server. The configuration is in `.mcp.json`:

```json
{
  "codex": {
    "command": "python3",
    "args": ["${CLAUDE_PLUGIN_ROOT}/servers/codex-mcp-server/server.py"],
    "env": {
      "CODEX_DEBUG": "${CODEX_DEBUG:-0}",
      "PYTHONPATH": "${CLAUDE_PLUGIN_ROOT}/servers/codex-mcp-server"
    }
  }
}
```

**Key settings:**

- `${CLAUDE_PLUGIN_ROOT}` - Variable for plugin-relative paths (resolved by Claude Code)
- `PYTHONPATH` - Enables Python module imports

**Important:** After changing MCP config, restart Claude Code to apply changes.

If the MCP server shows status "✘ failed", check:
1. Python3 is installed: `python3 --version`
2. Server starts correctly: `python3 servers/codex-mcp-server/server.py` (from plugin dir)
3. Debug output: `CODEX_DEBUG=1 python3 servers/codex-mcp-server/server.py`

## Enable Debug Mode

To see detailed debug logs for troubleshooting:

```bash
# Set environment variable to enable debug output
export CODEX_DEBUG=1

# Then run Claude Code
claude-code
```

When debug mode is enabled, the MCP server will output detailed logs to stderr showing:
- Authentication status and token details
- HTTP request/response details
- API call parameters and responses
- Error messages with context

## Testing the Authentication Flow

### Step 1: Configure Authentication

```
/codex-oauth:codex-config
```

This will:
1. Check authentication status
2. If not authenticated, open your browser to login
3. Save your OAuth tokens locally at `~/.claude/auth.json`

### Step 2: Verify Authentication

Check that tokens were saved:

```bash
cat ~/.claude/auth.json | jq '.openai_codex'
```

You should see:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "id_token": "...",
  "expires_at": 1234567890
}
```

### Step 3: Check Status

```
/codex-oauth:codex-status
```

Should show:
- `status: "authenticated"`
- `account_id: "..."`
- Token expiry information

## Testing API Queries

### Basic Test

```
/codex-oauth:codex What is 2+2?
```

### Enable Debug First

For detailed troubleshooting, enable debug mode before testing:

```bash
export CODEX_DEBUG=1
# Then restart Claude Code and try again
```

You'll see output like:

```
[CODEX] Sending query to Codex {"model": "gpt-5.2-codex", "prompt_length": 16}
[HTTP] Making POST request {"url": "https://chatgpt.com/backend-api/codex/responses"}
[HTTP] Response status: 200
[HTTP] Response body length: 1234
[CODEX] Raw response received {"response_type": "dict", "keys": ["choices", "id", "model", ...]}
[CODEX] Extracted content from message: 250 chars
```

## Common Issues

### Issue: "Not authenticated"

**Error message:** `Error: Not authenticated. Please run /codex-config to authenticate.`

**Solution:**
1. Run `/codex-oauth:codex-config` to complete OAuth flow
2. Check that tokens are saved: `cat ~/.claude/auth.json | jq '.openai_codex'`
3. Verify account ID was extracted: Check debug output for "account_id"

### Issue: "Authentication required" or token errors

**Error message:** `Error: Authentication required: ...`

**Solutions:**
1. **Tokens expired:** Run `/codex-oauth:codex-clear` then `/codex-oauth:codex-config` to re-authenticate
2. **Invalid tokens:** Delete `~/.claude/auth.json` and re-authenticate
3. **Network issues:** Check internet connection and try again

### Issue: "No response from Codex" or empty response

**Error message:** `Error: No response from Codex. Response: {"error": "..."}`

**Debugging steps:**
1. Enable debug mode: `export CODEX_DEBUG=1`
2. Check the HTTP response in logs
3. Verify your ChatGPT account is valid and has API access

### Issue: HTTP errors (401, 403, 429, etc.)

**Common codes:**
- `401 Unauthorized`: Token is invalid or expired
- `403 Forbidden`: Your account doesn't have access to Codex
- `429 Too Many Requests`: Rate limited - wait before retrying

**Solution:**
1. Check error details in debug mode
2. Clear and re-authenticate: `/codex-oauth:codex-clear` → `/codex-oauth:codex-config`
3. Verify your OpenAI account has ChatGPT Pro/Plus subscription

## Debug Log Format

Log messages are prefixed with component name:
- `[CODEX]` - Codex client service
- `[HTTP]` - HTTP client
- `[TOKEN]` - Token manager (if added)

Example debug output:

```
[CODEX] Sending query to Codex {"model": "gpt-5.2-codex", "prompt_length": 16}
[CODEX] Request headers {"keys": ["Authorization", "Content-Type", "ChatGPT-Account-Id"]}
[HTTP] Making POST request {"url": "https://chatgpt.com/backend-api/codex/responses"}
[HTTP] Request attempt 1/4
[HTTP] Response status: 200
[HTTP] Response body length: 1234
[CODEX] Raw response received {"response_type": "dict", "keys": ["choices", "id", "model", "usage"]}
[CODEX] Extracted content from message: 250 chars
```

## Test Script

The `test_codex_api.py` script can test API calls directly:

```bash
export CODEX_DEBUG=1
python3 test_codex_api.py
```

Output shows:
- Authentication status
- Access token and account ID
- Raw API response
- Extracted response text

## Files to Check

- **Token storage:** `~/.claude/auth.json` - OAuth tokens (permissions: 0600)
- **MCP server logs:** Check Claude Code stderr for server output
- **Plugin code:** `plugins/codex-oauth/servers/codex-mcp-server/`
- **Commands:** `.claude/commands/codex*.md` - User-facing commands

## Checking OAuth Token Details

Decode and inspect your JWT tokens:

```bash
# Extract access token and decode (using jq and base64)
TOKEN=$(cat ~/.claude/auth.json | jq -r '.openai_codex.access_token')
echo $TOKEN | cut -d'.' -f2 | base64 -D | jq '.'
```

Look for:
- `exp`: Token expiration timestamp
- `chatgpt_account_id`: Your Codex account ID
- `org_id`: Organization ID if applicable

## Performance Considerations

- First query may be slower while MCP server initializes
- Token refresh happens automatically (~5 min before expiry)
- Large responses may take longer to process
- Rate limits: Check debug logs if you hit 429 errors

## Next Steps

If issues persist:
1. Collect debug logs with timestamps
2. Check ~/.claude/auth.json is readable and has valid tokens
3. Verify internet connection to https://chatgpt.com
4. Try with a simple test query first
5. Check OpenAI account status at https://chatgpt.com
