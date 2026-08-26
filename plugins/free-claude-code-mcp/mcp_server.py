#!/usr/bin/env python3
"""
MCP Server for free-claude-code integration.

Exposes free-claude-code's proxy capabilities as MCP tools, allowing Claude Code
agents to route requests through the free-claude-code proxy server.
"""

import asyncio
import json
import os
import subprocess
import sys
import time
import httpx
from typing import Any

from mcp.server import Server
from mcp.types import (
    Tool,
    TextContent,
    ListToolsRequest,
    CallToolRequest,
    ListToolsResult,
)

# Configuration
FCC_SERVER_URL = os.getenv("FCC_SERVER_URL", "http://localhost:8000")
FCC_ENABLE_SERVER = os.getenv("FCC_ENABLE_SERVER", "false").lower() == "true"

server = Server("free-claude-code-mcp")
_server_process = None


def _get_tools() -> list[Tool]:
    """List available tools for interacting with free-claude-code proxy."""
    return [
        Tool(
            name="fcc_proxy_request",
            description=(
                "Send a request through the free-claude-code proxy. "
                "Useful for routing API calls to OpenAI-compatible providers "
                "with custom configuration, fallbacks, and provider selection."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "method": {
                        "type": "string",
                        "description": "HTTP method (GET, POST, etc.)",
                    },
                    "path": {
                        "type": "string",
                        "description": "API path (e.g., /v1/chat/completions)",
                    },
                    "body": {
                        "type": "object",
                        "description": "Request body (JSON)",
                    },
                    "provider": {
                        "type": "string",
                        "description": (
                            "Target provider override. Leave empty for default. "
                            "Supported: openai, anthropic, nvidia_nim, openrouter, etc."
                        ),
                    },
                },
                "required": ["method", "path"],
            },
        ),
        Tool(
            name="fcc_get_config",
            description=(
                "Retrieve current free-claude-code configuration including "
                "enabled providers, routing rules, and fallback settings."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="fcc_list_providers",
            description=(
                "List all configured providers in free-claude-code and their status "
                "(online, offline, misconfigured)."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="fcc_health_check",
            description="Check the health status of the free-claude-code proxy server.",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
    ]


async def handle_list_tools(request: ListToolsRequest) -> ListToolsResult:
    """Handle list_tools request."""
    return ListToolsResult(tools=_get_tools())


async def handle_call_tool(request: CallToolRequest) -> list[TextContent]:
    """Execute a tool call."""
    name = request.params.name
    arguments = request.params.arguments or {}
    try:
        if name == "fcc_proxy_request":
            return await handle_proxy_request(arguments)
        elif name == "fcc_get_config":
            return await handle_get_config()
        elif name == "fcc_list_providers":
            return await handle_list_providers()
        elif name == "fcc_health_check":
            return await handle_health_check()
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {type(e).__name__}: {e}")]


async def handle_proxy_request(args: dict[str, Any]) -> list[TextContent]:
    """Handle a proxy request through free-claude-code."""
    method = args.get("method", "GET").upper()
    path = args.get("path", "/")
    body = args.get("body")
    provider = args.get("provider")

    # Ensure server is running
    await _ensure_server_running()

    # Build URL
    url = f"{FCC_SERVER_URL}{path}"
    headers = {
        "Content-Type": "application/json",
    }
    if provider:
        headers["X-Provider"] = provider

    # Make request
    async with httpx.AsyncClient() as client:
        if method == "GET":
            resp = await client.get(url, headers=headers)
        elif method == "POST":
            resp = await client.post(url, json=body, headers=headers)
        elif method == "PUT":
            resp = await client.put(url, json=body, headers=headers)
        elif method == "DELETE":
            resp = await client.delete(url, headers=headers)
        else:
            return [TextContent(type="text", text=f"Unsupported method: {method}")]

    # Return response
    result = {
        "status": resp.status_code,
        "headers": dict(resp.headers),
        "body": resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text,
    }
    return [TextContent(type="text", text=json.dumps(result, indent=2))]


async def handle_get_config() -> list[TextContent]:
    """Retrieve current configuration."""
    await _ensure_server_running()

    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{FCC_SERVER_URL}/health/config")

    if resp.status_code == 200:
        return [TextContent(type="text", text=json.dumps(resp.json(), indent=2))]
    else:
        return [TextContent(type="text", text=f"Failed to fetch config: {resp.status_code}")]


async def handle_list_providers() -> list[TextContent]:
    """List all configured providers."""
    await _ensure_server_running()

    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{FCC_SERVER_URL}/health/providers")

    if resp.status_code == 200:
        return [TextContent(type="text", text=json.dumps(resp.json(), indent=2))]
    else:
        return [TextContent(type="text", text=f"Failed to fetch providers: {resp.status_code}")]


async def handle_health_check() -> list[TextContent]:
    """Check server health."""
    await _ensure_server_running()

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{FCC_SERVER_URL}/health", timeout=5)
            if resp.status_code == 200:
                return [TextContent(type="text", text=json.dumps(resp.json(), indent=2))]
            else:
                return [TextContent(type="text", text=f"Server returned status {resp.status_code}")]
        except Exception as e:
            return [TextContent(type="text", text=f"Health check failed: {e}")]


async def _ensure_server_running() -> None:
    """Ensure free-claude-code server is running."""
    global _server_process

    if not FCC_ENABLE_SERVER:
        # Server should be running externally; just verify connectivity
        async with httpx.AsyncClient() as client:
            try:
                await client.get(f"{FCC_SERVER_URL}/health", timeout=2)
            except Exception:
                raise RuntimeError(
                    f"Cannot reach free-claude-code server at {FCC_SERVER_URL}. "
                    "Ensure it's running or set FCC_ENABLE_SERVER=true"
                )
        return

    # If server is already running, verify it
    if _server_process and _server_process.poll() is None:
        try:
            async with httpx.AsyncClient() as client:
                await client.get(f"{FCC_SERVER_URL}/health", timeout=2)
            return
        except Exception:
            pass

    # Start server if needed
    try:
        _server_process = subprocess.Popen(
            ["fcc-server"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={**os.environ, "FCC_PORT": FCC_SERVER_URL.split(":")[-1]},
        )

        # Wait for server to be ready
        for _ in range(30):
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(f"{FCC_SERVER_URL}/health", timeout=2)
                    if resp.status_code == 200:
                        return
            except Exception:
                pass
            time.sleep(0.5)

        raise RuntimeError("Timeout waiting for free-claude-code server to start")
    except FileNotFoundError:
        raise RuntimeError(
            "fcc-server command not found. Install free-claude-code or ensure it's in PATH"
        )


async def main():
    """Run the MCP server."""
    # Register request handlers
    server.add_request_handler(ListToolsRequest, handle_list_tools)
    server.add_request_handler(CallToolRequest, handle_call_tool)

    async with server:
        print("free-claude-code MCP server started. Listening for requests...", file=sys.stderr)
        await server.wait()


if __name__ == "__main__":
    asyncio.run(main())
