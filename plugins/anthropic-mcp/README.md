# anthropic-mcp

Registers the official [`@anthropic-ai/mcp-server-anthropic`](https://www.npmjs.com/package/@anthropic-ai/mcp-server-anthropic) MCP server so Claude Code can call the Anthropic API directly as a tool.

## Prerequisites

- Node.js 18+ (for `npx`)
- An Anthropic API key

## Setup

Set your API key in your environment before starting Claude Code:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or add it to your shell profile so it is always available.

## What this installs

Installing this plugin adds an `anthropic` MCP server entry to your project's MCP configuration. The server is launched on demand via `npx` — no global install required.

## Usage

Once installed, the Anthropic MCP server's tools are available to Claude Code in any session started in this project. Refer to the [`@anthropic-ai/mcp-server-anthropic`](https://www.npmjs.com/package/@anthropic-ai/mcp-server-anthropic) package documentation for the full list of available tools.
