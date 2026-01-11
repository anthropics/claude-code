# Codex OAuth Plugin

OpenAI Codex integration for Claude Code with OAuth 2.0 authentication. Query Codex directly from Claude Code using MCP tools.

## Features

- 🔐 Secure OAuth 2.0 + PKCE authentication with OpenAI
- 💾 Token storage with secure file permissions (0600)
- 🔄 Automatic token refresh before expiry
- 🛠️ Easy-to-use commands: `/codex`, `/codex-config`, `/codex-clear`
- 📡 MCP server exposing 5 tools for programmatic access
- ⚡ Cross-platform compatible (Unix/Windows)
- 🎯 Auto-activation skill for Codex-related queries

## Quick Start

### 1. Installation

The plugin is included in Claude Code. Enable it by placing the `codex-oauth` directory in:

```bash
~/.claude/plugins/
```

Or if developing, symlink from the repository:

```bash
ln -s /path/to/claude-code/plugins/codex-oauth ~/.claude/plugins/codex-oauth
```

### 2. Authenticate

Start by running the configuration command:

```
/codex-config
```

This will:
1. Open your browser to OpenAI's OAuth login page
2. You'll log in with your ChatGPT Pro/Plus account
3. Grant permission for Claude Code to access Codex
4. Tokens are stored securely in `~/.claude/auth.json` (0600 permissions)

### 3. Use Codex

Query Codex with:

```
/codex how do I implement binary search in Python?
```

Or let the skill auto-activate:

```
Can you ask Codex about OAuth implementation?
```

## Commands

### `/codex <query>`

Send a question to OpenAI Codex.

**Examples:**
```
/codex explain REST API design principles
/codex write a Python async function for HTTP requests
/codex debug this JavaScript code: console.log(arr.map(x => x * 2))
```

### `/codex-config`

Check authentication status and configure authentication.

**Shows:**
- Authentication status (authenticated/expired/not_authenticated)
- Token expiry time
- Account ID
- Available models

**Re-authenticate** if needed.

### `/codex-clear`

Clear stored OAuth credentials. You'll need to run `/codex-config` again to re-authenticate.

**Use cases:**
- Switching to a different OpenAI account
- Troubleshooting authentication issues
- Security concerns

## Available Models

The plugin supports multiple Codex models:

- `gpt-5.2-codex` (default) - General coding tasks, best balance
- `gpt-5.1-codex-max` - Complex tasks, maximum capability
- `gpt-5.1-codex-mini` - Faster responses, lighter model
- `gpt-5.2` - General purpose model

The MCP server allows specifying models programmatically. Commands use the default model.

## How It Works

### Architecture

```
┌─────────────────────┐
│   Claude Code CLI   │
└──────────┬──────────┘
           │ (commands/skills)
           │
┌──────────▼──────────────────┐
│   MCP Server (Python)       │
│  - 5 tools via MCP protocol │
│  - OAuth flow management    │
│  - Token lifecycle          │
└──────────┬──────────────────┘
           │
    ┌──────┴──────────┬────────────┐
    │                 │            │
┌───▼────┐  ┌────────▼────┐  ┌───▼────┐
│OpenAI  │  │Local Storage│  │Callback│
│OAuth   │  │ ~/.claude/  │  │Server  │
│Endpoint│  │  auth.json  │  │:1455   │
└────────┘  └─────────────┘  └────────┘
```

### OAuth Flow

1. **Initialize**: User runs `/codex-config`
2. **Generate PKCE**: Cryptographically secure code verifier + challenge
3. **Browser Open**: Redirect to OpenAI OAuth authorization page
4. **User Login**: OpenAI account authentication
5. **Permission Grant**: User grants Claude Code access
6. **Callback**: OAuth callback server receives authorization code
7. **Token Exchange**: Exchange code for access + refresh tokens
8. **Secure Storage**: Tokens saved with 0600 permissions
9. **Auto-Refresh**: Tokens refresh automatically 5 minutes before expiry

### Token Storage

Tokens are stored in `~/.claude/auth.json`:

```json
{
  "codex": {
    "access_token": "sk-...",
    "refresh_token": "...",
    "token_type": "Bearer",
    "expires_at": 1704067200,
    "id_token": "eyJ..."
  }
}
```

**Security:**
- File permissions: 0600 (owner read/write only)
- Atomic writes with temp file + rename
- Cross-platform file locking
- No tokens in logs or stdout

## Troubleshooting

### Port 1455 Already in Use

The OAuth callback server uses port 1455. If it's in use:

```bash
# Find process using port 1455
lsof -i :1455

# Or on Windows
netstat -ano | findstr :1455
```

**Solution**: Stop the conflicting process or change `CALLBACK_PORT` in `config.py`.

### Authentication Fails

**Symptom**: Browser shows error, or `/codex-config` times out

**Solutions:**
1. Check internet connection
2. Ensure port 1455 is accessible locally
3. Clear credentials and retry: `/codex-clear` → `/codex-config`
4. Check if OpenAI account has Codex access (requires ChatGPT Plus/Pro)

### Token Expired / Not Authenticated

**Symptom**: `/codex` returns "Not authenticated" error

**Solution**: Run `/codex-config` to re-authenticate

The plugin auto-refreshes tokens 5 minutes before expiry. If refresh fails:
1. Run `/codex-config` to re-authenticate
2. If that fails, clear and reconfigure: `/codex-clear` → `/codex-config`

### Cross-Platform Issues (Windows)

The plugin uses cross-platform file locking:
- **Unix**: `fcntl` module (built-in)
- **Windows**: `msvcrt` module (built-in)

Both are Python standard library, no installation needed.

## MCP Tools (Programmatic Access)

For advanced use, you can call MCP tools directly:

### codex_query

Send a query to Codex.

**Parameters:**
- `prompt` (required): Your question
- `model` (optional): Which model to use
- `system_prompt` (optional): System context
- `temperature` (optional): 0-1, controls randomness (default: 0.7)

**Example:**
```python
{
  "prompt": "Write a function to validate email addresses",
  "model": "gpt-5.2-codex",
  "temperature": 0.5
}
```

### codex_status

Check authentication status.

**Returns:**
```json
{
  "status": "authenticated",
  "authenticated": true,
  "account_id": "user-123abc",
  "expires_in_seconds": 3600,
  "has_refresh_token": true,
  "is_expired": false,
  "needs_refresh": false
}
```

### codex_login

Initiate OAuth authentication flow.

**Returns:** Success message with account ID or error

### codex_clear

Clear stored credentials.

**Returns:** Confirmation message

### codex_models

List available models and default.

**Returns:**
```json
{
  "models": [
    "gpt-5.1-codex-max",
    "gpt-5.1-codex-mini",
    "gpt-5.2",
    "gpt-5.2-codex"
  ],
  "default": "gpt-5.2-codex"
}
```

## Development

### Project Structure

```
plugins/codex-oauth/
├── .claude-plugin/plugin.json       # Plugin manifest
├── .mcp.json                        # MCP server config
├── commands/                        # User commands
│   ├── codex.md
│   ├── codex-config.md
│   └── codex-clear.md
├── skills/codex-integration/        # Auto-activation skill
│   └── SKILL.md
└── servers/codex-mcp-server/
    ├── server.py                    # MCP server entry point
    ├── config.py                    # Configuration constants
    ├── infrastructure/              # Low-level utilities
    │   ├── pkce_generator.py        # RFC 7636 PKCE
    │   ├── token_storage.py         # Secure storage
    │   └── http_client.py           # HTTP wrapper
    └── services/                    # Business logic
        ├── oauth_flow.py            # OAuth 2.0 flow
        ├── token_manager.py         # Token lifecycle
        └── codex_client.py          # Codex API client
```

### Running Locally

1. **Install dependencies**: Already using Python stdlib only

2. **Configure debug mode**:
```bash
export CODEX_DEBUG=1
```

3. **Test the MCP server**:
```bash
cd plugins/codex-oauth/servers/codex-mcp-server
python3 server.py < /dev/null
```

4. **Check logs**:
```bash
# MCP logs go to stderr
tail -f ~/.claude/logs/codex-mcp-server.log
```

### Testing

Basic validation without OAuth:

```bash
# Test PKCE generation
python3 -c "from infrastructure.pkce_generator import PKCEGenerator; v, c = PKCEGenerator.generate_pair(); print(f'Verifier: {v}'); print(f'Challenge: {c}')"

# Test token storage
python3 -c "from infrastructure.token_storage import TokenStorage; ts = TokenStorage(); print('Storage OK')"
```

### Configuration

Edit `servers/codex-mcp-server/config.py` to customize:

```python
# OAuth endpoints
OAUTH_ENDPOINT = "https://auth.openai.com"  # Default OpenAI
CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"   # Public client ID

# Callback configuration
CALLBACK_PORT = 1455
CALLBACK_PATH = "/callback"

# Token management
TOKEN_REFRESH_BUFFER = 300  # Refresh 5 minutes before expiry
OAUTH_TIMEOUT = 120  # Authorization timeout in seconds
```

## Security Considerations

### OAuth Security

- ✅ **PKCE (RFC 7636)**: Prevents authorization code interception
- ✅ **State Parameter**: CSRF protection
- ✅ **Secure Random**: `secrets` module for cryptographic randomness
- ✅ **HTTPS Only**: All OAuth endpoints use HTTPS
- ✅ **Localhost Callback**: OAuth callback only accepts localhost:1455

### Token Security

- ✅ **Atomic Writes**: Temp file + rename prevents partial writes
- ✅ **Secure Permissions**: 0600 (owner only) on Unix
- ✅ **File Locking**: Cross-platform read/write locks prevent races
- ✅ **No Logging**: Tokens never logged or printed
- ✅ **Auto-Cleanup**: Failed operations clean up temp files

### Potential Concerns

⚠️ **OpenAI Client ID**: The client ID is hardcoded (public PKCE client). Rotating it requires code update for all users. Consider environment variable fallback in production.

⚠️ **Local Callback Server**: The OAuth callback listens on localhost:1455. If port is compromised, authorization could be intercepted. This is acceptable for local CLI tools.

⚠️ **No Certificate Pinning**: HTTPS certificate validation uses system defaults. MITM attacks possible on compromised systems.

## Limitations

1. **No Native Model Selection**: Codex models appear via MCP tools only, not as native Claude models. This is due to Claude Code architecture limitations.

2. **Per-Flow Authentication**: Each OAuth flow starts fresh (no concurrent flows). Multiple simultaneous auth attempts will interfere.

3. **Single Account**: Only one account's tokens stored at a time. Switch accounts via `/codex-clear` + `/codex-config`.

4. **No Streaming**: API responses are returned as complete text, not streamed.

## License

This plugin is part of Claude Code and follows the same license.

## Support

- GitHub Issues: [Report bugs](https://github.com/anthropics/claude-code/issues)
- Documentation: `/help`

## Changelog

### v1.0.0 (Initial Release)

- ✨ OAuth 2.0 + PKCE authentication
- 🔐 Secure token storage with 0600 permissions
- 🔄 Automatic token refresh
- 📡 MCP server with 5 tools
- 💻 Cross-platform compatibility (Unix/Windows)
- 🎯 Auto-activation skill for Codex queries
- ⚡ Ready for production use
