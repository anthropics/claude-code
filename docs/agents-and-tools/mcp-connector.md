# MCP Connector

The MCP connector enables direct connection to remote Model Context Protocol (MCP) servers through the Messages API without requiring a separate MCP client implementation.

## Overview

The MCP connector provides a streamlined way to integrate with MCP servers directly from the Claude Messages API. This eliminates the need to run a separate MCP client and allows you to access MCP tools with the same familiar API you use for standard tool calling.

## Key Features

### Direct API Integration
Connect to MCP servers directly through the Messages API without additional client software.

### Tool Calling Support
Access MCP server tools via the standard Messages API tool calling interface.

### OAuth Authentication
Support for authenticated server access using OAuth Bearer tokens.

### Multiple Server Support
Connect to multiple MCP servers in a single request, allowing you to combine tools from different sources.

## Current Limitations

The MCP connector currently has some limitations:

### Supported Features
- ✅ Tool calls from the MCP specification
- ✅ HTTP-based MCP servers (SSE and Streamable HTTP transports)
- ✅ OAuth authentication

### Not Yet Supported
- ❌ Local STDIO servers (only publicly exposed HTTP servers)
- ❌ Amazon Bedrock integration
- ❌ Google Vertex AI integration
- ❌ Other MCP features beyond tool calling (resources, prompts, etc.)

## Beta Header Requirement

To use the MCP connector, you must include the beta header in your API requests:

```
anthropic-beta: mcp-client-2025-04-04
```

### Example with cURL
```bash
curl https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: mcp-client-2025-04-04" \
  -d '{...}'
```

### Example with Python
```python
import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    extra_headers={
        "anthropic-beta": "mcp-client-2025-04-04"
    },
    messages=[...]
)
```

## Server Configuration

MCP servers are configured using the `mcp_servers` parameter in your API request. Each server requires the following fields:

### Required Fields

#### `type`
- Must be `"url"` (currently the only supported type)
- Future versions may support additional types like `"stdio"`

#### `url`
- HTTPS endpoint for the MCP server
- Must be a publicly accessible URL
- Supports SSE (Server-Sent Events) and Streamable HTTP transports

#### `name`
- Unique identifier for the server
- Used to disambiguate when multiple servers provide tools with the same name

### Optional Fields

#### `tool_configuration`
- Enable or restrict specific tools from the server
- Useful for limiting scope or preventing access to certain capabilities

#### `authorization_token`
- OAuth Bearer token for authenticated access
- Required when the MCP server requires authentication
- You must obtain this token through the server's OAuth flow

### Configuration Example

```python
import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    extra_headers={
        "anthropic-beta": "mcp-client-2025-04-04"
    },
    mcp_servers=[
        {
            "type": "url",
            "url": "https://api.example.com/mcp",
            "name": "example-server",
            "tool_configuration": {
                "allowed_tools": ["search", "analyze"]
            },
            "authorization_token": "your_oauth_token_here"
        }
    ],
    messages=[
        {"role": "user", "content": "Search for recent papers on AI"}
    ]
)
```

## Response Structure

When Claude uses MCP tools, the response includes two new content block types:

### `mcp_tool_use` Block

Indicates that Claude wants to use an MCP tool.

```python
{
    "type": "mcp_tool_use",
    "id": "toolu_abc123",
    "name": "search",
    "server": "example-server",
    "input": {
        "query": "AI papers",
        "limit": 10
    }
}
```

**Fields:**
- `type`: Always `"mcp_tool_use"`
- `id`: Unique identifier for this tool use
- `name`: Name of the tool being called
- `server`: Name of the MCP server (from your configuration)
- `input`: Parameters being passed to the tool

### `mcp_tool_result` Block

Contains the result of MCP tool execution.

```python
{
    "type": "mcp_tool_result",
    "tool_use_id": "toolu_abc123",
    "content": {
        "results": [...]
    },
    "status": "success"
}
```

**Fields:**
- `type`: Always `"mcp_tool_result"`
- `tool_use_id`: References the corresponding `mcp_tool_use` block
- `content`: Tool execution result
- `status`: Execution status (`"success"` or `"error"`)

## Authentication

API consumers must handle OAuth flows independently and obtain access tokens before making requests to authenticated MCP servers.

### OAuth Flow Steps

1. **Register your application** with the MCP server provider
2. **Initiate OAuth flow** to get user authorization
3. **Exchange authorization code** for access token
4. **Include token** in `authorization_token` field
5. **Refresh token** as needed before expiration

### MCP Inspector for Testing

The MCP Inspector tool can assist with obtaining tokens for testing purposes:

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Launch inspector
mcp-inspector
```

The inspector provides a UI for:
- Testing MCP server connections
- Viewing available tools
- Obtaining OAuth tokens for development

## Complete Example

Here's a complete example showing MCP connector usage:

```python
import anthropic
import os

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# Step 1: Initial request with MCP server configured
response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    extra_headers={
        "anthropic-beta": "mcp-client-2025-04-04"
    },
    mcp_servers=[
        {
            "type": "url",
            "url": "https://mcp.example.com/api",
            "name": "research-tools",
            "authorization_token": os.environ.get("MCP_TOKEN")
        }
    ],
    messages=[
        {
            "role": "user",
            "content": "Find recent research papers about neural networks"
        }
    ]
)

print("Initial response:", response)

# Step 2: Handle MCP tool use
if response.stop_reason == "tool_use":
    tool_results = []

    for content in response.content:
        if content.type == "mcp_tool_use":
            print(f"MCP tool called: {content.name} on {content.server}")
            print(f"Input: {content.input}")

            # Tool execution happens automatically on the server
            # Results come back in the response

    # Step 3: Continue conversation with tool results
    # (MCP tools are executed server-side, so we just continue the conversation)
    follow_up = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        extra_headers={
            "anthropic-beta": "mcp-client-2025-04-04"
        },
        mcp_servers=[
            {
                "type": "url",
                "url": "https://mcp.example.com/api",
                "name": "research-tools",
                "authorization_token": os.environ.get("MCP_TOKEN")
            }
        ],
        messages=[
            {"role": "user", "content": "Find recent research papers about neural networks"},
            {"role": "assistant", "content": response.content},
            {"role": "user", "content": "Can you summarize the top 3 papers?"}
        ]
    )

    print("Follow-up response:", follow_up)
```

## TypeScript Example

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

async function useMcpTools() {
    const message = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        extra_headers: {
            'anthropic-beta': 'mcp-client-2025-04-04'
        },
        mcp_servers: [
            {
                type: 'url',
                url: 'https://mcp.example.com/api',
                name: 'data-tools',
                tool_configuration: {
                    allowed_tools: ['query_database', 'analyze_data']
                },
                authorization_token: process.env.MCP_TOKEN
            }
        ],
        messages: [
            {
                role: 'user',
                content: 'Analyze the sales data from last quarter'
            }
        ]
    });

    console.log(message);
}

useMcpTools();
```

## Best Practices

### Security
1. **Never hardcode tokens**: Use environment variables or secure vaults
2. **Rotate tokens regularly**: Implement token refresh logic
3. **Limit tool access**: Use `tool_configuration` to restrict available tools
4. **Validate server URLs**: Ensure you're connecting to trusted servers

### Performance
1. **Reuse connections**: Multiple requests can use the same server configuration
2. **Handle errors gracefully**: MCP servers may be unavailable
3. **Set appropriate timeouts**: Don't let requests hang indefinitely
4. **Monitor usage**: Track MCP tool calls for debugging and optimization

### Error Handling
1. **Check stop_reason**: Verify MCP tool execution completed
2. **Parse tool results**: Handle both success and error cases
3. **Implement retries**: For transient failures
4. **Log failures**: Track issues for debugging

## Troubleshooting

### Common Issues

**"MCP server unreachable"**
- Verify the server URL is correct and publicly accessible
- Check that the server supports HTTP-based MCP (not STDIO)
- Ensure firewall rules allow outbound HTTPS connections

**"Authentication failed"**
- Verify the OAuth token is valid and not expired
- Check that the token has the required scopes
- Ensure the token is properly formatted (Bearer token)

**"Tool not found"**
- Check that the tool name matches exactly (case-sensitive)
- Verify the server provides the requested tool
- Review `tool_configuration` settings

**"Beta header missing"**
- Include `anthropic-beta: mcp-client-2025-04-04` header
- Check for typos in the header name or value

## See Also

- [Agent SDK Overview](../agent-sdk/overview.md) - Build agents with MCP integration
- [Tool Use Overview](./tool-use/overview.md) - Learn about Claude's tool capabilities
- [Agent Skills](./agent-skills.md) - Extend Claude with skills
- [MCP Specification](https://spec.modelcontextprotocol.io/) - Official MCP protocol docs
