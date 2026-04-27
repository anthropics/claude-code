---
name: mcp-builder
description: This skill should be used when the user asks to "build an MCP server", "create an MCP tool", "implement Model Context Protocol", "make Claude use a custom tool via MCP", "build an MCP integration", "expose an API as MCP tools", or develop any MCP (Model Context Protocol) server or client.
version: 1.0.0
---

# MCP Server Builder

This skill guides building Model Context Protocol (MCP) servers — custom tool integrations that extend Claude's capabilities with external data, APIs, and services.

## What MCP Servers Do

MCP servers expose **tools**, **resources**, and **prompts** to Claude:
- **Tools**: Functions Claude can call (e.g., query a database, call an API)
- **Resources**: Data sources Claude can read (e.g., files, documents)
- **Prompts**: Pre-built prompt templates

## Quick Start

### Python MCP Server (recommended)

```bash
pip install mcp
```

```python
# server.py
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

app = Server("my-server")

@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_weather",
            description="Get current weather for a city",
            inputSchema={
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name"}
                },
                "required": ["city"]
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "get_weather":
        city = arguments["city"]
        # Call your actual API here
        result = f"Weather in {city}: 72°F, Sunny"
        return [TextContent(type="text", text=result)]
    raise ValueError(f"Unknown tool: {name}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream,
                      InitializationOptions(server_name="my-server", server_version="1.0.0"))

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

### TypeScript MCP Server

```bash
npm install @modelcontextprotocol/sdk
```

```typescript
// server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "my-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "search",
    description: "Search for information",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"]
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "search") {
    return { content: [{ type: "text", text: `Results for: ${args?.query}` }] };
  }
  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Configuring in Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "python",
      "args": ["server.py"],
      "env": {
        "API_KEY": "${MY_API_KEY}"
      }
    }
  }
}
```

For Node.js:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["dist/server.js"]
    }
  }
}
```

## Adding Resources

Resources let Claude read data from your server:

```python
from mcp.types import Resource

@app.list_resources()
async def list_resources() -> list[Resource]:
    return [
        Resource(
            uri="myserver://config",
            name="Configuration",
            description="Current system configuration",
            mimeType="application/json"
        )
    ]

@app.read_resource()
async def read_resource(uri: str) -> str:
    if uri == "myserver://config":
        return json.dumps({"version": "1.0", "env": "production"})
    raise ValueError(f"Unknown resource: {uri}")
```

## Common Patterns

### Database Query Tool

```python
import sqlite3

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "query_db":
        conn = sqlite3.connect("app.db")
        cursor = conn.execute(arguments["sql"])
        rows = cursor.fetchall()
        conn.close()
        return [TextContent(type="text", text=str(rows))]
```

### REST API Wrapper

```python
import httpx

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "call_api":
        async with httpx.AsyncClient() as client:
            response = await client.get(
                arguments["url"],
                headers={"Authorization": f"Bearer {API_KEY}"}
            )
            return [TextContent(type="text", text=response.text)]
```

## Best Practices

- Keep tool descriptions precise — Claude uses them to decide when to call the tool
- Return structured data (JSON) when the result will be processed further
- Include error details in return values rather than raising exceptions (Claude can handle errors gracefully)
- Use environment variables for secrets; never hardcode API keys
- Implement `list_tools()` to return all tools, even if only one is used
- Test locally with `claude --mcp-server python server.py` before integrating
- Add input validation in `call_tool()` before making external calls
