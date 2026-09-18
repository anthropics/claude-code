# free-claude-code MCP Server Plugin

An MCP (Model Context Protocol) server that integrates **free-claude-code** into Claude Code's plugin ecosystem. This plugin enables Claude Code agents and the business-agent to route API requests through the free-claude-code proxy server, providing:

- **Multi-provider support**: Route requests to OpenAI, Anthropic, Nvidia NIM, OpenRouter, etc.
- **Provider fallbacks**: Automatic failover between providers
- **Custom routing rules**: Configure request routing per path/method
- **Configuration management**: Inspect and manage active providers and routing rules

## Installation

This plugin is installed as part of the Claude Code fork. It's automatically available when using Claude Code with this repository.

## Usage

### As an MCP Server

The plugin exposes the following tools:

#### `fcc_proxy_request`

Send an HTTP request through the free-claude-code proxy.

**Parameters:**
- `method` (string, required): HTTP method (GET, POST, etc.)
- `path` (string, required): API path (e.g., `/v1/chat/completions`)
- `body` (object, optional): Request body (JSON)
- `provider` (string, optional): Target provider override (leave empty for default)

**Example:**
```python
await agent.call_tool(
    "fcc_proxy_request",
    {
        "method": "POST",
        "path": "/v1/chat/completions",
        "body": {
            "model": "gpt-4",
            "messages": [{"role": "user", "content": "Hello"}],
        },
        "provider": "openai"
    }
)
```

#### `fcc_get_config`

Retrieve the current free-claude-code configuration.

**Parameters:** None

#### `fcc_list_providers`

List all configured providers and their status.

**Parameters:** None

#### `fcc_health_check`

Check the health of the free-claude-code server.

**Parameters:** None

## Configuration

### Environment Variables

- `FCC_SERVER_URL` (default: `http://localhost:8000`): URL of the free-claude-code proxy server
- `FCC_ENABLE_SERVER` (default: `false`): If `true`, the MCP server will attempt to start the free-claude-code server automatically

### Setup

1. **External Server Mode** (Recommended):
   ```bash
   # In one terminal, start the free-claude-code server
   fcc-server

   # In another, use Claude Code with the plugin available
   ```

2. **Auto-Start Mode**:
   ```bash
   export FCC_ENABLE_SERVER=true
   # Claude Code will now automatically start free-claude-code when needed
   ```

## Architecture

```
Claude Code Agent
    ↓
MCP Server (this plugin)
    ↓
free-claude-code Proxy
    ↓
AI Provider APIs (OpenAI, Anthropic, etc.)
```

### How It Works

1. Claude Code agents call MCP tools exposed by this plugin
2. The MCP server communicates with a running `free-claude-code` proxy server
3. The proxy routes requests to configured AI providers with fallback support
4. Responses are returned to the agent

## Integration with Business Agent

The `business-agent` can use this plugin to:

- Route its API calls through free-claude-code for flexible provider selection
- Implement fallback strategies if a provider is unavailable
- Switch providers dynamically based on requirements or load

**Example in agent YAML:**
```yaml
mcp_servers:
  - type: local
    name: free-claude-code
    command: uv
    args: ["run", "--directory", "./plugins/free-claude-code-mcp", "python", "mcp_server.py"]
```

## Development

### Prerequisites

- Python 3.14+
- `uv` package manager
- `free-claude-code` installed (or the source repo available)

### Running the MCP Server Standalone

```bash
cd plugins/free-claude-code-mcp
export FCC_SERVER_URL=http://localhost:8000
uv run python mcp_server.py
```

### Testing Tools

```bash
# With free-claude-code running in another terminal
uv run python -c "
import asyncio
from mcp_server import call_tool

# Health check
result = asyncio.run(call_tool('fcc_health_check', {}))
print(result)
"
```

## Troubleshooting

### "Cannot reach free-claude-code server"

- Ensure free-claude-code is running: `fcc-server`
- Verify the URL with `echo $FCC_SERVER_URL` (should be `http://localhost:8000` by default)
- Check that the server is listening on the correct port: `curl http://localhost:8000/health`

### Server won't start

- Install free-claude-code from the source: `uv install -e ../free-claude-code`
- Or set `FCC_ENABLE_SERVER=false` and start the server manually

## License

Same as Claude Code (this fork)
