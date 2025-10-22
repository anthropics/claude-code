# Claude Code Authentication Mechanism Analysis

## Overview

This document provides a comprehensive analysis of how Claude Code authenticates and communicates with the Anthropic Claude API (claude.ai). This analysis is based on exploration of the Claude Code repository, API documentation, and industry best practices.

## Table of Contents

1. [Authentication Method](#authentication-method)
2. [API Endpoints](#api-endpoints)
3. [Request Structure](#request-structure)
4. [Security Practices](#security-practices)
5. [Session Management](#session-management)
6. [Python Implementation Example](#python-implementation-example)

---

## Authentication Method

### Primary Authentication: API Key

Claude Code uses **API Key authentication** to communicate with the Anthropic API. This is a simple, secure, and widely-used authentication method.

#### Key Details:

- **Header Name**: `x-api-key`
- **Header Value**: Your Anthropic API key
- **Source**: Environment variable `ANTHROPIC_API_KEY` or interactive login

#### Authentication Flow:

```
1. User installs Claude Code via npm
   └─> npm install -g @anthropic-ai/claude-code

2. On first run, Claude Code checks for API credentials:
   ├─> Checks ANTHROPIC_API_KEY environment variable
   ├─> Checks macOS Keychain (if on macOS)
   └─> If not found, prompts for interactive login

3. Every API request includes:
   └─> x-api-key: <your-api-key>
```

### Alternative Authentication Methods

Claude Code also supports:

1. **AWS Bedrock**: Uses `AWS_BEARER_TOKEN_BEDROCK` environment variable
2. **Vertex AI**: Uses Google Cloud credentials with region configuration
3. **OAuth/Session-based**: For interactive terminal sessions with automatic token refresh

---

## API Endpoints

### Base URL

```
https://api.anthropic.com/v1
```

### Primary Endpoint: Messages API

```
POST https://api.anthropic.com/v1/messages
```

This is the main endpoint used by Claude Code to send messages and receive responses from Claude.

### Required Headers

Every request to the Anthropic API must include these headers:

| Header | Value | Description |
|--------|-------|-------------|
| `x-api-key` | `<your-api-key>` | Authentication credential |
| `anthropic-version` | `2023-06-01` | API version (required) |
| `Content-Type` | `application/json` | Request content type |

#### Optional Headers

| Header | Value | Description |
|--------|-------|-------------|
| `anthropic-beta` | Feature flag | Enable beta features (e.g., "output-128k-2025-02-19") |
| `User-Agent` | Client identifier | Identifies the client application |

---

## Request Structure

### Basic Request Format

```json
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 4096,
  "messages": [
    {
      "role": "user",
      "content": "Hello, Claude!"
    }
  ]
}
```

### Full Request Example

```json
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 4096,
  "temperature": 1.0,
  "system": "You are a helpful coding assistant.",
  "messages": [
    {
      "role": "user",
      "content": "Explain how to use the Claude API"
    }
  ]
}
```

### Request Parameters

#### Required Parameters

- **`model`**: The Claude model to use
  - Examples: `claude-sonnet-4-5-20250929`, `claude-3-7-sonnet-20250219`, `claude-4-haiku-20250514`
- **`max_tokens`**: Maximum number of tokens in the response (required)
  - Range: 1 to 128000 (depending on model and beta features)
- **`messages`**: Array of message objects with `role` and `content`

#### Optional Parameters

- **`system`**: System prompt to guide Claude's behavior
- **`temperature`**: Randomness in responses (0.0 to 1.0)
- **`top_p`**: Nucleus sampling parameter
- **`top_k`**: Top-k sampling parameter
- **`stop_sequences`**: Array of sequences that will stop generation
- **`stream`**: Boolean to enable streaming responses

### Response Format

```json
{
  "id": "msg_01XYZ...",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! I'm Claude..."
    }
  ],
  "model": "claude-sonnet-4-5-20250929",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 12,
    "output_tokens": 45
  }
}
```

---

## Security Practices

Claude Code implements several security best practices:

### 1. No Hardcoded Credentials

- ✅ API keys are **never** hardcoded in source code
- ✅ All credentials come from environment variables or secure storage
- ✅ `.env` files are excluded via `.gitignore`

### 2. Secure Storage

- **macOS**: API keys stored in macOS Keychain
- **Environment Variables**: `ANTHROPIC_API_KEY` for runtime configuration
- **GitHub Actions**: API keys stored as GitHub Secrets

### 3. Token Management

- **Session-based tokens**: 5-minute TTL with automatic refresh
- **OAuth tokens**: Proactive refresh before expiration
- **MCP OAuth**: Automatic token refresh for Model Context Protocol servers

### 4. Code Patterns from Repository

From `/home/user/claude-code/scripts/auto-close-duplicates.ts:28-47`:

```typescript
async function githubRequest<T>(endpoint: string, token: string, method: string = 'GET', body?: any): Promise<T> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,  // Bearer token pattern
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "auto-close-duplicates-script",
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

This pattern shows how Claude Code handles API authentication:
- Token passed as parameter (from environment)
- Proper error handling
- Clear separation of concerns

---

## Session Management

### Session Features in Claude Code

Based on the CHANGELOG.md analysis:

1. **Session IDs**: Each session has a unique identifier for tracking
2. **Session Lifecycle Hooks**:
   - `SessionStart`: Triggered when a session begins
   - `SessionEnd`: Triggered when a session ends
3. **Session Persistence**: Conversations can be saved and resumed
4. **Cost Tracking**: Token usage tracked per session
5. **State Management**: Session state maintained across interactions

### Session Flow

```
┌─────────────────────────────────────────────────┐
│ User starts Claude Code                         │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ SessionStart Hook Triggered                     │
│ - Generate Session ID                           │
│ - Load user preferences                         │
│ - Initialize API client                         │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ API Request Cycle                               │
│ 1. Build request with x-api-key header          │
│ 2. Send POST to /v1/messages                    │
│ 3. Receive and parse response                   │
│ 4. Update token usage tracking                  │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ SessionEnd Hook Triggered                       │
│ - Save session data                             │
│ - Log usage statistics                          │
│ - Clean up resources                            │
└─────────────────────────────────────────────────┘
```

---

## Python Implementation Example

A complete Python implementation is provided in `claude_api_client.py`. Here's a simplified example:

### Basic Usage

```python
from claude_api_client import ClaudeAPIClient
import os

# Initialize client (reads ANTHROPIC_API_KEY from environment)
client = ClaudeAPIClient()

# Send a message
response = client.send_message(
    message="Hello, Claude!",
    max_tokens=1024
)

# Print the response
for content in response['content']:
    if content['type'] == 'text':
        print(content['text'])
```

### With System Prompt

```python
response = client.send_message(
    message="Write a Python function to calculate Fibonacci numbers",
    system="You are an expert Python programmer. Write clean, efficient code.",
    max_tokens=2048
)
```

### Multi-turn Conversation

```python
conversation = [
    {"role": "user", "content": "My name is Alice"},
    {"role": "assistant", "content": "Nice to meet you, Alice!"}
]

response = client.send_message(
    message="What's my name?",
    conversation_history=conversation,
    max_tokens=100
)
```

---

## Complete HTTP Request Example

Here's what a complete HTTP request from Claude Code looks like:

```http
POST /v1/messages HTTP/1.1
Host: api.anthropic.com
x-api-key: sk-ant-api03-xxx...
anthropic-version: 2023-06-01
Content-Type: application/json
User-Agent: claude-code/2.0.25

{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 4096,
  "messages": [
    {
      "role": "user",
      "content": "Help me debug this code"
    }
  ]
}
```

---

## Environment Variables Reference

| Variable | Purpose | Required |
|----------|---------|----------|
| `ANTHROPIC_API_KEY` | Primary authentication for Claude API | Yes (unless using OAuth) |
| `AWS_BEARER_TOKEN_BEDROCK` | Authentication for AWS Bedrock | Only for Bedrock |
| `GITHUB_TOKEN` | GitHub API access | Only for GitHub features |
| `STATSIG_API_KEY` | Analytics/telemetry | No |

---

## Getting Your API Key

1. Visit [https://console.anthropic.com/](https://console.anthropic.com/)
2. Sign in or create an account
3. Navigate to "API Keys" section
4. Click "Create Key"
5. Copy the key and store it securely

**Security Note**: Never commit API keys to version control or share them publicly.

---

## Testing the Implementation

To test the provided Python script:

```bash
# Set your API key
export ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"

# Run the demo script
python claude_api_client.py
```

The script will demonstrate:
1. Simple message sending
2. Using system prompts
3. Multi-turn conversations
4. Response parsing and display

---

## Key Takeaways

1. **Authentication is simple**: Just use the `x-api-key` header with your API key
2. **API version is required**: Always include `anthropic-version: 2023-06-01`
3. **Request format is JSON**: POST requests with model, max_tokens, and messages
4. **Security first**: Never hardcode keys, use environment variables
5. **Session management**: Claude Code maintains session state for continuity
6. **Token tracking**: Usage is tracked per session for cost management

---

## Additional Resources

- [Official Anthropic API Documentation](https://docs.anthropic.com/en/api)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Anthropic Python SDK](https://github.com/anthropics/anthropic-sdk-python)
- [Claude Code GitHub Repository](https://github.com/anthropics/claude-code)

---

*Document generated: 2025-10-22*
*Analysis based on Claude Code repository and Anthropic API documentation*
