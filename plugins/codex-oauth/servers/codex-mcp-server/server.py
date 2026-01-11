#!/usr/bin/env python3
"""MCP Server for OpenAI Codex integration.

Implements Model Context Protocol (MCP) to expose Codex as tools:
- codex_query: Send queries to Codex
- codex_status: Check authentication status
- codex_login: Start OAuth authentication flow
- codex_clear: Clear stored credentials
- codex_models: List available models
"""

import json
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import DEBUG
from infrastructure.token_storage import TokenStorage
from infrastructure.http_client import HttpClient
from services.oauth_flow import OAuthFlow, OAuthError
from services.token_manager import TokenManager, TokenError
from services.codex_client import CodexClient, CodexError


class MCPServer:
    """MCP Server implementing Codex tools."""

    def __init__(self):
        """Initialize MCP server with service dependencies."""
        self.storage = TokenStorage()
        self.http_client = HttpClient()
        self.oauth_flow = OAuthFlow(self.storage, self.http_client)
        self.token_manager = TokenManager(self.storage, self.oauth_flow)
        self.codex_client = CodexClient(self.token_manager, self.http_client)

    def handle_request(self, request: dict) -> dict:
        """Handle MCP request.

        Args:
            request: MCP request dictionary

        Returns:
            MCP response dictionary
        """
        method = request.get("method")
        params = request.get("params", {})
        request_id = request.get("id")

        if method == "initialize":
            return self._handle_initialize(request_id, params)
        elif method == "tools/list":
            return self._handle_list_tools(request_id)
        elif method == "tools/call":
            return self._handle_call_tool(request_id, params)
        elif method == "notifications/initialized":
            # Acknowledgment, no response needed
            return None
        else:
            return self._error_response(
                request_id,
                -32601,
                f"Method not found: {method}"
            )

    def _handle_initialize(self, request_id: int, params: dict) -> dict:
        """Handle initialize request."""
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "codex-oauth",
                    "version": "1.0.0"
                }
            }
        }

    def _handle_list_tools(self, request_id: int) -> dict:
        """Handle tools/list request."""
        tools = [
            {
                "name": "codex_query",
                "description": "Send a query to OpenAI Codex and get a response. Use this for AI-powered assistance, code generation, and explanations.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "prompt": {
                            "type": "string",
                            "description": "The question or request to send to Codex"
                        },
                        "model": {
                            "type": "string",
                            "description": "Model to use (default: gpt-5.2-codex)",
                            "enum": CodexClient.ALLOWED_MODELS
                        },
                        "system_prompt": {
                            "type": "string",
                            "description": "Optional system prompt to set context"
                        },
                        "temperature": {
                            "type": "number",
                            "description": "Sampling temperature 0-1 (default: 0.7)"
                        }
                    },
                    "required": ["prompt"]
                }
            },
            {
                "name": "codex_status",
                "description": "Check OpenAI Codex authentication status. Shows whether you're logged in, token expiry, and account info.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "codex_login",
                "description": "Start OAuth authentication flow for OpenAI Codex. Opens browser for login.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "codex_clear",
                "description": "Clear stored Codex OAuth credentials. You will need to re-authenticate.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "codex_models",
                "description": "List available Codex models.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            }
        ]

        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "tools": tools
            }
        }

    def _handle_call_tool(self, request_id: int, params: dict) -> dict:
        """Handle tools/call request."""
        tool_name = params.get("name")
        arguments = params.get("arguments", {})

        try:
            if tool_name == "codex_query":
                result = self._tool_query(arguments)
            elif tool_name == "codex_status":
                result = self._tool_status()
            elif tool_name == "codex_login":
                result = self._tool_login()
            elif tool_name == "codex_clear":
                result = self._tool_clear()
            elif tool_name == "codex_models":
                result = self._tool_models()
            else:
                return self._error_response(
                    request_id,
                    -32602,
                    f"Unknown tool: {tool_name}"
                )

            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": result if isinstance(result, str) else json.dumps(result, indent=2)
                        }
                    ]
                }
            }

        except Exception as e:
            # Return error in content text (MCP-compliant approach)
            # The isError flag is non-standard; errors are indicated in content text
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Error: {str(e)}"
                        }
                    ]
                }
            }

    def _tool_query(self, arguments: dict) -> str:
        """Execute codex_query tool."""
        prompt = arguments.get("prompt")
        if not prompt:
            raise ValueError("prompt is required")

        model = arguments.get("model")
        system_prompt = arguments.get("system_prompt")
        temperature = arguments.get("temperature", 0.7)

        return self.codex_client.query(
            prompt=prompt,
            model=model,
            system_prompt=system_prompt,
            temperature=temperature
        )

    def _tool_status(self) -> dict:
        """Execute codex_status tool."""
        info = self.token_manager.get_token_info()

        if not info["authenticated"]:
            return {
                "status": "not_authenticated",
                "message": "Not logged in. Run codex_login to authenticate."
            }

        status = "authenticated"
        if info["is_expired"]:
            status = "expired"
        elif info["needs_refresh"]:
            status = "needs_refresh"

        return {
            "status": status,
            "authenticated": info["authenticated"],
            "account_id": info.get("account_id"),
            "expires_in_seconds": info.get("expires_in_seconds"),
            "has_refresh_token": info.get("has_refresh_token", False),
            "message": f"Logged in. Token {'expired' if info['is_expired'] else f'expires in {info[\"expires_in_seconds\"]} seconds'}."
        }

    def _tool_login(self) -> str:
        """Execute codex_login tool."""
        try:
            self.oauth_flow.start_auth_flow()
            info = self.token_manager.get_token_info()
            return f"Successfully authenticated! Account: {info.get('account_id', 'N/A')}"
        except OAuthError as e:
            return f"Authentication failed: {e}"

    def _tool_clear(self) -> str:
        """Execute codex_clear tool."""
        self.token_manager.clear_tokens()
        return "Credentials cleared. You will need to re-authenticate with codex_login."

    def _tool_models(self) -> dict:
        """Execute codex_models tool."""
        return {
            "models": self.codex_client.get_models(),
            "default": CodexClient.DEFAULT_MODEL
        }

    def _error_response(self, request_id: int, code: int, message: str) -> dict:
        """Create error response."""
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": code,
                "message": message
            }
        }


def main():
    """Main entry point for MCP server."""
    server = MCPServer()

    if DEBUG:
        sys.stderr.write("Codex MCP Server started (debug mode)\n")

    # Read from stdin, write to stdout (MCP stdio transport)
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            if DEBUG:
                sys.stderr.write(f"Request: {json.dumps(request)}\n")

            response = server.handle_request(request)

            if response is not None:
                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()

                if DEBUG:
                    sys.stderr.write(f"Response: {json.dumps(response)}\n")

        except json.JSONDecodeError as e:
            if DEBUG:
                sys.stderr.write(f"JSON decode error: {e}\n")
            error_response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": f"Parse error: {e}"
                }
            }
            sys.stdout.write(json.dumps(error_response) + "\n")
            sys.stdout.flush()
        except Exception as e:
            if DEBUG:
                sys.stderr.write(f"Server error: {e}\n")
            error_response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32603,
                    "message": f"Internal error: {e}"
                }
            }
            sys.stdout.write(json.dumps(error_response) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
