# Claude API Client - Quick Start Guide

This directory contains a Python implementation demonstrating how Claude Code authenticates and communicates with the Anthropic Claude API.

## Files

- **`AUTHENTICATION_ANALYSIS.md`**: Comprehensive analysis of Claude Code's authentication mechanism
- **`claude_api_client.py`**: Python script that implements Claude API authentication and messaging
- **`API_CLIENT_README.md`**: This file

## Quick Start

### Prerequisites

1. Python 3.6 or higher (no external dependencies required - uses only standard library)
2. An Anthropic API key

### Getting an API Key

1. Visit [https://console.anthropic.com/](https://console.anthropic.com/)
2. Sign in or create an account
3. Navigate to "API Keys" section
4. Click "Create Key"
5. Copy the generated key

### Running the Demo

```bash
# 1. Set your API key as an environment variable
export ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"

# 2. Run the demo script
python claude_api_client.py

# Or make it executable and run directly
chmod +x claude_api_client.py
./claude_api_client.py
```

## Usage Examples

### Example 1: Simple Message

```python
from claude_api_client import ClaudeAPIClient

# Initialize client
client = ClaudeAPIClient()

# Send a message
response = client.send_message(
    message="What is the capital of France?",
    max_tokens=100
)

# Print response
print(response['content'][0]['text'])
```

### Example 2: With System Prompt

```python
response = client.send_message(
    message="Write a hello world program",
    system="You are an expert Python programmer. Always include comments.",
    max_tokens=500
)
```

### Example 3: Multi-turn Conversation

```python
# Build conversation history
conversation = [
    {"role": "user", "content": "I'm learning Python"},
    {"role": "assistant", "content": "That's great! Python is a wonderful language to learn."}
]

# Continue the conversation
response = client.send_message(
    message="Can you recommend a good first project?",
    conversation_history=conversation,
    max_tokens=1000
)
```

### Example 4: Using Different Models

```python
# Use Claude 3.7 Sonnet
response = client.send_message(
    message="Explain quantum computing",
    model="claude-3-7-sonnet-20250219",
    max_tokens=2000
)

# Use Claude 4 Haiku (faster, cheaper)
response = client.send_message(
    message="What's 2+2?",
    model="claude-4-haiku-20250514",
    max_tokens=50
)
```

## Understanding the Code

### Authentication Flow

```python
# The client reads the API key from environment
client = ClaudeAPIClient()  # Reads ANTHROPIC_API_KEY

# Or pass it directly
client = ClaudeAPIClient(api_key="sk-ant-api03-...")
```

### Headers Built by the Client

```python
headers = {
    "x-api-key": "your-api-key",           # Authentication
    "anthropic-version": "2023-06-01",     # Required API version
    "Content-Type": "application/json",    # JSON content
    "User-Agent": "claude-api-client-python/1.0"
}
```

### Request Body Structure

```python
request_body = {
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "messages": [
        {"role": "user", "content": "Your message here"}
    ],
    "temperature": 1.0,  # Optional
    "system": "System prompt here"  # Optional
}
```

## Advanced Usage

### Custom Request Parameters

```python
response = client.send_message(
    message="Write a poem",
    model="claude-sonnet-4-5-20250929",
    max_tokens=1000,
    temperature=0.7,  # More focused responses
    top_p=0.9,
    stop_sequences=["The End"]
)
```

### Error Handling

```python
try:
    response = client.send_message(
        message="Hello!",
        max_tokens=100
    )
except HTTPError as e:
    print(f"API Error: {e}")
except ValueError as e:
    print(f"Configuration Error: {e}")
```

## How This Relates to Claude Code

This implementation demonstrates the **exact same authentication mechanism** that Claude Code uses:

1. **API Key Authentication**: Claude Code stores your API key securely and includes it in the `x-api-key` header
2. **Version Header**: All requests include the `anthropic-version` header
3. **Messages Endpoint**: Uses the `/v1/messages` endpoint for all interactions
4. **JSON Requests**: Sends properly formatted JSON with model, max_tokens, and messages

The main differences:
- Claude Code has additional features like session management, hooks, and MCP integration
- Claude Code stores API keys securely in the OS keychain
- Claude Code has a sophisticated CLI interface

But the **core authentication and API communication** is identical.

## Troubleshooting

### "No API key provided" Error

```bash
# Make sure you've set the environment variable
echo $ANTHROPIC_API_KEY

# If empty, set it:
export ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"
```

### HTTP 401 Unauthorized

- Check that your API key is correct
- Verify the key hasn't been revoked in the Anthropic Console
- Make sure there are no extra spaces or quotes in the key

### HTTP 429 Rate Limit

- You've exceeded your rate limit
- Wait a moment and try again
- Consider upgrading your API plan

### Connection Errors

- Check your internet connection
- Verify you can reach api.anthropic.com
- Check if you're behind a corporate firewall

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for API keys
3. **Rotate keys regularly** in the Anthropic Console
4. **Limit key permissions** to only what's needed
5. **Monitor usage** in the Anthropic Console

## API Limits and Costs

- Different models have different costs per token
- Track your usage in the Anthropic Console
- Set up billing alerts to avoid surprises
- Use cheaper models (like Haiku) for simple tasks

## Further Reading

For a detailed analysis of the authentication mechanism, see:
- **`AUTHENTICATION_ANALYSIS.md`** - Comprehensive authentication documentation

For official documentation:
- [Anthropic API Documentation](https://docs.anthropic.com/en/api)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)

## Contributing

This is a demonstration script for educational purposes. Feel free to modify and extend it for your own use cases.

## License

This code is provided as-is for educational purposes. See the main repository LICENSE.md for details.

---

**Questions or Issues?**

- Check the AUTHENTICATION_ANALYSIS.md for detailed documentation
- Visit [Anthropic Support](https://support.anthropic.com/)
- Review [Claude Code GitHub Issues](https://github.com/anthropics/claude-code/issues)
