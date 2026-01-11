# Codex OAuth Plugin - Implementation Summary

## Overview

This document explains the Codex OAuth plugin architecture and what has been fixed to enable real API functionality.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ User Command                                         │
│ /codex-oauth:codex "your question"                  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Command Handler (.claude/commands/codex.md)         │
│ - Checks authentication status                      │
│ - Routes to appropriate MCP tool                    │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ MCP Server (Python)                                 │
│ servers/codex-mcp-server/server.py                  │
│ - Receives tool calls via stdio                     │
│ - Instantiates service classes                      │
│ - Routes to correct tool handler                    │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Service Layer                                       │
│ ┌─────────────────────────────────────────────┐     │
│ │ TokenManager (services/token_manager.py)    │     │
│ │ - Manages OAuth tokens                      │     │
│ │ - Auto-refreshes before expiry              │     │
│ │ - Extracts ChatGPT account ID from JWT      │     │
│ ├─────────────────────────────────────────────┤     │
│ │ CodexClient (services/codex_client.py)      │     │
│ │ - Builds API requests                       │     │
│ │ - Calls HTTP client with auth headers       │     │
│ │ - Parses responses                          │     │
│ └─────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Infrastructure Layer                                │
│ ┌─────────────────────────────────────────────┐     │
│ │ HttpClient (infrastructure/http_client.py)  │     │
│ │ - Makes actual HTTPS requests               │     │
│ │ - Handles retries and errors                │     │
│ │ - Parses JSON responses                     │     │
│ ├─────────────────────────────────────────────┤     │
│ │ TokenStorage (infrastructure/token_storage) │     │
│ │ - Saves tokens to ~/.claude/auth.json       │     │
│ │ - Protects with file permissions (0600)     │     │
│ ├─────────────────────────────────────────────┤     │
│ │ OAuthFlow (services/oauth_flow.py)          │     │
│ │ - Implements OAuth 2.0 + PKCE               │     │
│ │ - Manages callback server                   │     │
│ └─────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ External API                                        │
│ https://chatgpt.com/backend-api/codex/responses     │
│ (Requires valid OAuth token)                        │
└─────────────────────────────────────────────────────┘
```

## Key Components

### 1. Command Layer (.claude/commands/)

- **codex-config.md** - Authentication setup
  - Checks status
  - Initiates OAuth flow if needed
  - Lists available models

- **codex.md** - Query execution
  - Verifies authentication
  - Calls codex_query tool with user prompt
  - Displays response

- **codex-clear.md** - Token management
  - Clears stored credentials
  - Requires re-authentication

- **codex-status.md** - Authentication status
  - Shows token validity
  - Displays account ID
  - Shows expiry information

### 2. MCP Server (server.py)

Handles 5 MCP tools:

- **codex_query** - Send query to Codex API
  - Input: prompt, model, system_prompt, temperature
  - Output: Text response from Codex
  - Uses: CodexClient.query()

- **codex_status** - Check authentication
  - Output: Status, account ID, token expiry
  - Uses: TokenManager.get_token_info()

- **codex_login** - Start OAuth flow
  - Opens browser for login
  - Saves tokens on completion
  - Uses: OAuthFlow.start_auth_flow()

- **codex_clear** - Clear credentials
  - Deletes stored tokens
  - Uses: TokenManager.clear_tokens()

- **codex_models** - List available models
  - Output: Array of model names and default
  - Uses: CodexClient.get_models()

### 3. Service Layer

**TokenManager** (services/token_manager.py)
- Caches tokens in memory
- Auto-refreshes 5 min before expiry
- Extracts ChatGPT account ID from JWT claims
- Implements token lifecycle management

**CodexClient** (services/codex_client.py)
- Builds OpenAI-compatible chat completion requests
- Adds Bearer token authorization
- Adds ChatGPT-Account-Id header
- Parses responses (handles multiple formats)
- Provides health check endpoint

**OAuthFlow** (services/oauth_flow.py)
- Implements OAuth 2.0 + PKCE (RFC 7636)
- Manages local callback server
- Opens browser for login
- Thread-safe token exchange
- Implements refresh token support

### 4. Infrastructure Layer

**HttpClient** (infrastructure/http_client.py)
- Thread-safe HTTP requests (urllib)
- Automatic retries with exponential backoff
- Proper error handling
- JSON request/response handling
- SSL context management

**TokenStorage** (infrastructure/token_storage.py)
- Atomic file writes
- Secure permissions (0600 on Unix, ACLs on Windows)
- Cross-platform file locking
- JSON token format

**PKCEGenerator** (infrastructure/pkce_generator.py)
- Generates cryptographically secure verifiers
- Computes SHA-256 challenges
- Prevents modulo bias

## What Was Fixed

### 1. Added Comprehensive Debugging

**Debug Mode** (CODEX_DEBUG environment variable)
```bash
export CODEX_DEBUG=1
claude-code
```

Enables detailed logging at each layer:
- `[CODEX]` - CodexClient operations
- `[HTTP]` - HttpClient requests/responses
- `[TOKEN]` - Token operations (if added)

Benefits:
- Understand request/response flow
- Diagnose authentication issues
- Debug API response parsing
- Track error origins

### 2. Improved Error Handling

**Specific Error Messages:**
- "Not authenticated" → suggests `/codex-config`
- "Token expired" → suggests retry
- "HTTP 401" → likely auth failure
- "No response from Codex" → shows actual response for debugging

**Better Context:**
- HTTP status codes with error bodies
- API response samples in error messages
- JWT token validation feedback

### 3. Enhanced Response Parsing

Handles multiple response formats:
- Standard OpenAI format: `choices[0].message.content`
- Streaming delta format: `choices[0].delta.content`
- Error responses with diagnostics
- Empty responses with helpful messages

### 4. Created Testing & Debugging Guides

- **DEBUGGING.md** - Comprehensive troubleshooting guide
- **CODEX_QUICK_START.md** - Getting started guide
- **test_codex_api.py** - Direct API testing script

## Real vs Stub Implementation

The implementation is **NOT stub/mock**:

✓ Makes real HTTPS requests to `https://chatgpt.com/backend-api/codex/responses`
✓ Uses real OAuth tokens from OpenAI
✓ Extracts real ChatGPT account ID from JWT
✓ Parses real API responses
✓ Auto-refreshes tokens

The confusion may come from:
1. **Needs valid authentication** - Without completed OAuth flow, all API calls will fail
2. **Requires valid subscription** - ChatGPT Pro/Plus required
3. **Real network calls** - May timeout if network unavailable
4. **Actual API limits** - May hit rate limits if querying too frequently

## Request Format

Example Codex API request:

```http
POST https://chatgpt.com/backend-api/codex/responses HTTP/1.1
Host: chatgpt.com
Authorization: Bearer {access_token}
ChatGPT-Account-Id: {account_id}
Content-Type: application/json

{
  "model": "gpt-5.2-codex",
  "messages": [
    {"role": "user", "content": "Your question"}
  ],
  "temperature": 0.7
}
```

## Response Format

Example successful response:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-5.2-codex",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The response text here..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 50,
    "total_tokens": 60
  }
}
```

## Testing the Implementation

### Basic Flow

```bash
# 1. Enable debug output
export CODEX_DEBUG=1

# 2. Start Claude Code
claude-code

# 3. Configure authentication (first time only)
/codex-oauth:codex-config

# 4. Check status
/codex-oauth:codex-status

# 5. Try a query
/codex-oauth:codex What is Python?
```

### What to Look For

Success indicators in debug output:
```
[CODEX] Sending query to Codex
[HTTP] Making POST request
[HTTP] Response status: 200
[CODEX] Extracted content from message: 250 chars
```

Error indicators:
```
[HTTP] HTTP error: 401 (missing/invalid token)
[HTTP] HTTP error: 403 (account not authorized)
[HTTP] HTTP error: 429 (rate limited)
[CODEX] No response from Codex (parse error)
```

## Files Changed in This Update

1. **infrastructure/http_client.py**
   - Added DEBUG logging
   - Improved error messages
   - Better error context

2. **services/codex_client.py**
   - Added DEBUG logging
   - Enhanced response parsing
   - Better error messages
   - Account ID verification

3. **DEBUGGING.md** (new)
   - Troubleshooting guide
   - Debug mode instructions
   - Common issues and solutions

4. **CODEX_QUICK_START.md** (new)
   - Getting started guide
   - Test sequences
   - Performance notes

5. **test_codex_api.py** (new)
   - Direct API testing script
   - Useful for diagnosis

## Next Steps for Users

1. **Install plugin** - Done (already in plugins/ directory)
2. **Configure auth** - Run `/codex-oauth:codex-config`
3. **Test status** - Run `/codex-oauth:codex-status`
4. **Try a query** - Run `/codex-oauth:codex "your question"`
5. **If issues** - Enable debug and check DEBUGGING.md

## Limitations and Notes

- **Requires subscription**: ChatGPT Pro or Plus
- **Rate limited**: OpenAI API rate limits apply
- **Network dependent**: Requires internet connection
- **Token expiry**: Handled automatically
- **First use slow**: MCP server initialization takes time
- **Response times**: Varies (typically 5-30 seconds)

## Comparison with OpenCode

| Aspect | OpenCode | Claude Code Plugin |
|--------|----------|------------------|
| Architecture | Fetch hook intercept | MCP server |
| Auth | OAuth flow | OAuth flow |
| Token storage | OpenCode auth store | ~/.claude/auth.json |
| Integration | Native model provider | Commands + MCP tools |
| Availability | Global fetch | Per-command basis |
| Streaming | Native support | Single response |

The implementation is designed specifically for Claude Code's MCP architecture while maintaining compatibility with OpenAI's Codex API.
