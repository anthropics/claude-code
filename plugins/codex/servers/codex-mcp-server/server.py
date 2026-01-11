#!/usr/bin/env python3
"""MCP Server for OpenAI Codex integration.

Implements Model Context Protocol (MCP) to expose Codex as tools:
- codex_query: Send queries to Codex
- codex_status: Check authentication status
- codex_login: Start OAuth authentication flow
- codex_clear: Clear stored credentials
- codex_models: List available models
- codex_get_config: Get current config
- codex_set_config: Set config values
- codex_list_sessions: List recent sessions
- codex_resume_session: Resume a session
"""

import json
import sys
import os
import uuid

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import DEBUG, AVAILABLE_MODELS, APPROVAL_MODES, AUTH_METHOD_OAUTH, AUTH_METHOD_API_KEY, AUTH_METHODS
from infrastructure.token_storage import TokenStorage
from infrastructure.http_client import HttpClient
from services.oauth_flow import OAuthFlow, OAuthError
from services.token_manager import TokenManager, TokenError
from services.codex_client import CodexClient, CodexError
from services.user_config import UserConfig, UserConfigError


class MCPServer:
    """MCP Server implementing Codex tools."""

    def __init__(self):
        """Initialize MCP server with service dependencies."""
        self.storage = TokenStorage()
        self.http_client = HttpClient()
        self.oauth_flow = OAuthFlow(self.storage, self.http_client)
        self.token_manager = TokenManager(self.storage, self.oauth_flow)
        self.codex_client = CodexClient(self.token_manager, self.http_client)
        self.user_config = UserConfig()

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
                    "name": "codex",
                    "version": "1.2.0"
                }
            }
        }

    def _handle_list_tools(self, request_id: int) -> dict:
        """Handle tools/list request."""
        tools = [
            {
                "name": "codex_query",
                "description": "Send a query to OpenAI Codex and get a response. Use this for AI-powered assistance, code generation, and explanations. Use session_id to continue an existing conversation.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "prompt": {
                            "type": "string",
                            "description": "The question or request to send to Codex"
                        },
                        "session_id": {
                            "type": "string",
                            "description": "Session ID to continue an existing conversation. If not provided, starts a new session."
                        },
                        "model": {
                            "type": "string",
                            "description": "Model to use (default: gpt-5.2-codex)"
                        },
                        "reasoning_effort": {
                            "type": "string",
                            "description": "Reasoning effort level (none/minimal/low/medium/high/xhigh). Controls how much the model thinks before responding.",
                            "enum": ["none", "minimal", "low", "medium", "high", "xhigh"]
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
                "description": "Start OAuth authentication for ChatGPT subscription (Plus/Pro/Team/Enterprise). Opens browser for login.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "codex_set_api_key",
                "description": "Set OpenAI API key for authentication (usage-based billing). Use this instead of OAuth if you have an API key.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "api_key": {
                            "type": "string",
                            "description": "OpenAI API key (starts with 'sk-')"
                        }
                    },
                    "required": ["api_key"]
                }
            },
            {
                "name": "codex_clear",
                "description": "Clear all stored Codex credentials (OAuth tokens and API key). You will need to re-authenticate.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "codex_models",
                "description": "List available Codex models (static fallback list).",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "codex_list_models",
                "description": "Fetch available models dynamically from Codex API. Returns full model info including supported reasoning efforts for each model. Use this instead of codex_models for accurate, up-to-date model information.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "codex_get_config",
                "description": "Get current Codex configuration including default model and approval mode.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "codex_set_config",
                "description": "Set Codex configuration values like default model, reasoning effort, or approval mode.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "key": {
                            "type": "string",
                            "description": "Config key to set",
                            "enum": ["model", "reasoning_effort", "approval_mode"]
                        },
                        "value": {
                            "type": "string",
                            "description": "Value to set"
                        }
                    },
                    "required": ["key", "value"]
                }
            },
            {
                "name": "codex_list_sessions",
                "description": "List recent Codex sessions.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of sessions to return (default: 10)"
                        }
                    }
                }
            },
            {
                "name": "codex_clear_sessions",
                "description": "Clear all Codex session history.",
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
            elif tool_name == "codex_set_api_key":
                result = self._tool_set_api_key(arguments)
            elif tool_name == "codex_clear":
                result = self._tool_clear()
            elif tool_name == "codex_models":
                result = self._tool_models()
            elif tool_name == "codex_list_models":
                result = self._tool_list_models()
            elif tool_name == "codex_get_config":
                result = self._tool_get_config()
            elif tool_name == "codex_set_config":
                result = self._tool_set_config(arguments)
            elif tool_name == "codex_list_sessions":
                result = self._tool_list_sessions(arguments)
            elif tool_name == "codex_clear_sessions":
                result = self._tool_clear_sessions()
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

    def _tool_query(self, arguments: dict) -> dict:
        """Execute codex_query tool."""
        prompt = arguments.get("prompt")
        if not prompt:
            raise ValueError("prompt is required")

        # Use user's defaults if not specified
        model = arguments.get("model") or self.user_config.get_model()
        system_prompt = arguments.get("system_prompt")
        temperature = arguments.get("temperature", 0.7)
        reasoning_effort = arguments.get("reasoning_effort") or self.user_config.get_reasoning_effort()

        # Check if continuing an existing session
        session_id = arguments.get("session_id")
        previous_messages = []

        if session_id:
            # Load existing session messages
            session = self.user_config.get_session(session_id)
            if session:
                previous_messages = session.get("messages", [])
        else:
            # Create new session
            session_id = str(uuid.uuid4())[:8]
            self.user_config.add_session(session_id, prompt)

        # Query Codex with conversation history
        response = self.codex_client.query(
            prompt=prompt,
            model=model,
            system_prompt=system_prompt,
            temperature=temperature,
            messages=previous_messages,
            reasoning_effort=reasoning_effort
        )

        # Update session with new messages
        new_messages = previous_messages + [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": response}
        ]
        self.user_config.update_session(session_id, new_messages)

        # Return response with session_id for continuation
        return {
            "response": response,
            "session_id": session_id,
            "message_count": len(new_messages)
        }

    def _tool_status(self) -> dict:
        """Execute codex_status tool."""
        info = self.token_manager.get_token_info()
        auth_method = info.get("auth_method")

        if not info["authenticated"]:
            return {
                "status": "not_authenticated",
                "auth_method": None,
                "available_methods": AUTH_METHODS,
                "message": "Not logged in. Use codex_login (OAuth) or codex_set_api_key (API key) to authenticate."
            }

        # Direct API Key authentication
        if auth_method == AUTH_METHOD_API_KEY:
            return {
                "status": "authenticated",
                "auth_method": AUTH_METHOD_API_KEY,
                "api_key_masked": info.get("api_key_masked"),
                "message": info.get("message", "Authenticated with API key")
            }

        # OAuth authentication (with or without token-exchanged API key)
        if info.get("has_api_key"):
            # OAuth with token exchange - got an API key
            return {
                "status": "authenticated",
                "auth_method": AUTH_METHOD_OAUTH,
                "has_api_key": True,
                "api_key_masked": info.get("api_key_masked"),
                "account_id": info.get("account_id"),
                "message": info.get("message", "Authenticated via ChatGPT subscription")
            }

        # OAuth without token exchange - using access_token directly
        status = "authenticated"
        if info.get("is_expired"):
            status = "expired"
        elif info.get("needs_refresh"):
            status = "needs_refresh"

        message = "Authenticated with ChatGPT subscription"
        if info.get("is_expired"):
            message = "Token expired - will refresh automatically"
        elif info.get("expires_in_seconds"):
            message = f"Token expires in {info.get('expires_in_seconds', 0)} seconds"

        return {
            "status": status,
            "auth_method": AUTH_METHOD_OAUTH,
            "has_api_key": False,
            "authenticated": info["authenticated"],
            "account_id": info.get("account_id"),
            "expires_in_seconds": info.get("expires_in_seconds"),
            "has_refresh_token": info.get("has_refresh_token", False),
            "message": message
        }

    def _tool_login(self) -> str:
        """Execute codex_login tool (OAuth for ChatGPT subscription)."""
        try:
            self.oauth_flow.start_auth_flow()
            info = self.token_manager.get_token_info()
            return f"Successfully authenticated with ChatGPT subscription! Account: {info.get('account_id', 'N/A')}"
        except OAuthError as e:
            return f"OAuth authentication failed: {e}"

    def _tool_set_api_key(self, arguments: dict) -> str:
        """Execute codex_set_api_key tool."""
        api_key = arguments.get("api_key")
        if not api_key:
            raise ValueError("api_key is required")

        try:
            self.token_manager.set_api_key(api_key)
            masked = api_key[:7] + "..." + api_key[-4:] if len(api_key) > 15 else "sk-***"
            return f"API key set successfully: {masked}"
        except TokenError as e:
            raise ValueError(str(e))

    def _tool_clear(self) -> str:
        """Execute codex_clear tool."""
        self.token_manager.clear_all()
        return "All credentials cleared (OAuth tokens and API key). You will need to re-authenticate."

    def _tool_models(self) -> dict:
        """Execute codex_models tool (static fallback)."""
        return {
            "models": self.codex_client.get_models(),
            "default": self.user_config.get_model()
        }

    def _tool_list_models(self) -> dict:
        """Execute codex_list_models tool (dynamic API fetch)."""
        result = self.codex_client.fetch_models_from_api()
        result["current_model"] = self.user_config.get_model()
        return result

    def _tool_get_config(self) -> dict:
        """Execute codex_get_config tool."""
        config = self.user_config.get_config()
        auth_info = self.token_manager.get_token_info()
        return {
            "model": config["model"],
            "reasoning_effort": config.get("reasoning_effort", "medium"),
            "approval_mode": config["approval_mode"],
            "available_models": AVAILABLE_MODELS,
            "available_reasoning_efforts": ["none", "minimal", "low", "medium", "high", "xhigh"],
            "available_approval_modes": APPROVAL_MODES,
            "available_auth_methods": AUTH_METHODS,
            "auth_method": auth_info.get("auth_method"),
            "authenticated": auth_info.get("authenticated", False),
            "session_count": config["session_count"]
        }

    def _tool_set_config(self, arguments: dict) -> str:
        """Execute codex_set_config tool."""
        key = arguments.get("key")
        value = arguments.get("value")

        if not key or not value:
            raise ValueError("Both 'key' and 'value' are required")

        try:
            self.user_config.set_config(key, value)
            return f"Config updated: {key} = {value}"
        except UserConfigError as e:
            raise ValueError(str(e))

    def _tool_list_sessions(self, arguments: dict) -> dict:
        """Execute codex_list_sessions tool."""
        limit = arguments.get("limit", 10)
        sessions = self.user_config.get_sessions(limit)
        return {
            "sessions": sessions,
            "count": len(sessions)
        }

    def _tool_clear_sessions(self) -> str:
        """Execute codex_clear_sessions tool."""
        self.user_config.clear_sessions()
        return "Session history cleared."

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
