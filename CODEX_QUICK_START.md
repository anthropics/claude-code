# Codex OAuth Plugin - Quick Start & Testing

## Installation

The plugin is already installed. To verify:

```bash
# Check plugin is registered
cat ~/.claude/plugins.json | jq '.plugins[] | select(.name == "codex-oauth")'
```

## Setup (First Time Only)

### 1. Configure Authentication

```
/codex-oauth:codex-config
```

This will:
- Open a browser window for OpenAI login
- Exchange authorization code for tokens
- Save tokens to `~/.claude/auth.json`

**Requirements:**
- OpenAI account with ChatGPT Pro or Plus subscription
- Valid internet connection

### 2. Verify Authentication

Check token status:

```
/codex-oauth:codex-status
```

Expected output:
```json
{
  "status": "authenticated",
  "authenticated": true,
  "account_id": "user-...",
  "expires_in_seconds": 3600,
  "has_refresh_token": true,
  "message": "Logged in. Token expires in 3600 seconds."
}
```

## Using Codex

### Basic Query

```
/codex-oauth:codex What are the main features of Python?
```

### With Specific Model

Models available:
- `gpt-5.2-codex` (default - recommended)
- `gpt-5.2`
- `gpt-5.1-codex-max`
- `gpt-5.1-codex-mini`

```
/codex-oauth:codex --model gpt-5.2 Explain quantum computing
```

### With System Prompt

```
/codex-oauth:codex --system "You are a Python expert" How do I use decorators?
```

## Testing Implementation

### Enable Debug Output

```bash
# In your shell before starting Claude Code
export CODEX_DEBUG=1

# Then restart Claude Code
claude-code
```

### Test Sequence

1. **Verify OAuth tokens exist:**
   ```bash
   test -f ~/.claude/auth.json && echo "Tokens found" || echo "No tokens"
   ```

2. **Check status:**
   ```
   /codex-oauth:codex-status
   ```

   Look for:
   - ✓ `status: "authenticated"`
   - ✓ `account_id` is present and not empty
   - ✓ `expires_in_seconds` > 0

3. **Try simple query:**
   ```
   /codex-oauth:codex What is 2+2?
   ```

   Expected: Should return "4" or similar mathematical answer

4. **Try complex query:**
   ```
   /codex-oauth:codex Write a Python function to sort a list
   ```

   Expected: Should provide Python code

5. **Monitor debug output:**

   With `CODEX_DEBUG=1`, you should see:
   ```
   [CODEX] Sending query to Codex {"model": "gpt-5.2-codex", ...}
   [HTTP] Making POST request {"url": "https://chatgpt.com/backend-api/codex/responses"}
   [HTTP] Response status: 200
   [HTTP] Response body length: 1234
   [CODEX] Extracted content from message: 250 chars
   ```

## Troubleshooting

### Command shows error or no response

1. **Check status:**
   ```
   /codex-oauth:codex-status
   ```

2. **Enable debug:**
   ```bash
   export CODEX_DEBUG=1
   # Restart Claude Code and try again
   ```

3. **Check logs for errors:**
   - Look for `[CODEX]` or `[HTTP]` messages in stderr
   - Note any error codes (401, 403, 429, etc.)

### Authentication fails

**Error: "Not authenticated"**
- Run `/codex-oauth:codex-config` again
- Check internet connection
- Verify OpenAI account status

**Error: "Token expired"**
- Tokens auto-refresh, but if stuck:
  ```
  /codex-oauth:codex-clear
  /codex-oauth:codex-config
  ```

### No response or timeout

1. Check internet connection
2. Verify `https://chatgpt.com` is accessible
3. Try simpler query first
4. Check debug output for HTTP errors
5. If rate limited (429), wait before retrying

### Garbled or incomplete response

- Enable debug mode and check raw API response
- Try disabling streaming (if applicable)
- Check system message isn't interfering

## Files & Locations

- **Plugin directory:** `plugins/codex-oauth/`
- **MCP server:** `plugins/codex-oauth/servers/codex-mcp-server/`
- **Command files:** `.claude/commands/codex*.md`
- **Token storage:** `~/.claude/auth.json` (private, 0600)
- **Debug guide:** `plugins/codex-oauth/DEBUGGING.md`

## Advanced Testing

### Direct API Test

Test API calls without going through commands:

```bash
export CODEX_DEBUG=1
python3 test_codex_api.py
```

This will:
1. Check authentication status
2. Extract access token and account ID
3. Make a test API call
4. Show raw response
5. Extract and display response content

### Inspect Saved Tokens

```bash
# View token metadata (careful with credentials)
cat ~/.claude/auth.json | jq '.openai_codex | {expires_at, has_refresh: (.refresh_token != null)}'

# Decode JWT to see claims (don't share with others!)
TOKEN=$(cat ~/.claude/auth.json | jq -r '.openai_codex.access_token')
echo $TOKEN | cut -d'.' -f2 | base64 -D | jq '.'
```

## Performance Notes

- **First initialization:** May take 2-3 seconds for MCP server startup
- **Token refresh:** Automatic, happens ~5 min before expiry
- **Response time:** Depends on Codex processing (typically 5-30 seconds)
- **Rate limits:** Check debug logs if you get 429 errors

## Getting Help

1. **Check debug output:** `export CODEX_DEBUG=1` then restart
2. **Read debugging guide:** `plugins/codex-oauth/DEBUGGING.md`
3. **Test API directly:** Run `python3 test_codex_api.py`
4. **Check tokens:** `cat ~/.claude/auth.json | jq '.openai_codex'`
5. **Try re-authentication:** `/codex-oauth:codex-clear` then `/codex-oauth:codex-config`

## Known Limitations

- Requires ChatGPT Pro or Plus subscription
- Rate limited by OpenAI (check documentation)
- Tokens expire after period (auto-refresh handles this)
- Some models may have feature limitations

## What's Different from OpenCode?

- Claude Code plugin architecture (vs OpenCode app)
- MCP server-based implementation (vs fetch hook)
- Token stored in `~/.claude/auth.json` (vs OpenCode's storage)
- Exposed as `/codex-oauth` commands (vs integrated model provider)
