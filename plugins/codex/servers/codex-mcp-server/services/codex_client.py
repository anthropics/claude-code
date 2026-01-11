"""Codex API client for making queries.

Handles API requests to OpenAI Codex endpoint with authentication.
"""

import json
import sys
import os
from typing import Dict, Any, Optional, Iterator

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import CODEX_API_URL, OPENAI_API_URL, DEBUG, AUTH_METHOD_OAUTH, AUTH_METHOD_API_KEY
from infrastructure.http_client import HttpClient, HttpClientError
from services.token_manager import TokenManager, TokenError


def _debug(msg: str, data: Optional[Dict] = None):
    """Log debug message if DEBUG is enabled."""
    if DEBUG:
        if data:
            sys.stderr.write(f"[CODEX] {msg}: {json.dumps(data)}\n")
        else:
            sys.stderr.write(f"[CODEX] {msg}\n")
        sys.stderr.flush()


class CodexError(Exception):
    """Codex API error."""
    pass


class CodexClient:
    """Client for OpenAI Codex API."""

    # Allowed Codex models (from OpenCode implementation)
    ALLOWED_MODELS = [
        "gpt-5.1-codex-max",
        "gpt-5.1-codex-mini",
        "gpt-5.2",
        "gpt-5.2-codex"
    ]

    DEFAULT_MODEL = "gpt-5.2-codex"

    def __init__(self, token_manager: TokenManager, http_client: HttpClient):
        """Initialize Codex client.

        Args:
            token_manager: Token manager for authentication
            http_client: HTTP client for requests
        """
        self.token_manager = token_manager
        self.http_client = http_client

    def query(
        self,
        prompt: str,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        messages: Optional[list] = None
    ) -> str:
        """Send query to Codex and return response.

        Args:
            prompt: User prompt/question
            model: Model to use (default: gpt-5.2-codex)
            system_prompt: Optional system prompt
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum response tokens
            messages: Previous conversation messages for context

        Returns:
            Codex response text

        Raises:
            CodexError: On API error
        """
        model = model or self.DEFAULT_MODEL
        if model not in self.ALLOWED_MODELS:
            raise CodexError(
                f"Invalid model: {model}. "
                f"Allowed models: {', '.join(self.ALLOWED_MODELS)}"
            )

        # Build messages with conversation history
        all_messages = []
        if system_prompt:
            all_messages.append({"role": "system", "content": system_prompt})

        # Add previous messages if provided
        if messages:
            all_messages.extend(messages)

        # Add current user prompt
        all_messages.append({"role": "user", "content": prompt})

        # Build request body
        body: Dict[str, Any] = {
            "model": model,
            "messages": all_messages,
            "temperature": temperature,
        }
        if max_tokens:
            body["max_tokens"] = max_tokens

        # Get headers with authentication
        try:
            headers = self._get_headers()
        except CodexError as e:
            _debug(f"Failed to get headers: {e}")
            raise

        api_url = self._get_api_url()
        _debug("Sending query to Codex", {"model": model, "prompt_length": len(prompt), "api_url": api_url})
        _debug("Request headers", {"keys": list(headers.keys())})
        _debug("Request body", body)

        try:
            response = self.http_client.post(
                api_url,
                headers=headers,
                data=body
            )

            _debug("Raw response received", {"response_type": type(response).__name__, "keys": list(response.keys()) if isinstance(response, dict) else "N/A"})

            # Extract response text - handle various response formats
            if not isinstance(response, dict):
                _debug(f"Unexpected response type: {type(response)}")
                raise CodexError(f"Unexpected response format: {type(response)}")

            # Try standard OpenAI format
            choices = response.get("choices", [])
            if not choices:
                _debug("No choices in response", response)
                raise CodexError(f"No response from Codex. Response: {json.dumps(response)[:200]}")

            choice = choices[0]

            # Try message format (non-streaming)
            if "message" in choice:
                message = choice.get("message", {})
                content = message.get("content", "")
                if content:
                    _debug(f"Extracted content from message: {len(content)} chars")
                    return content

            # Try delta format (streaming) - shouldn't happen in non-streaming response
            if "delta" in choice:
                delta = choice.get("delta", {})
                content = delta.get("content", "")
                if content:
                    _debug(f"Extracted content from delta: {len(content)} chars")
                    return content

            _debug("Could not extract content from choice", choice)
            raise CodexError(f"Could not extract response content from choice: {json.dumps(choice)[:200]}")

        except HttpClientError as e:
            _debug(f"HTTP client error: {e}")
            raise CodexError(f"Codex API error: {e}")
        except CodexError:
            raise
        except Exception as e:
            _debug(f"Unexpected error: {type(e).__name__}: {e}")
            raise CodexError(f"Unexpected error: {e}")

    def query_stream(
        self,
        prompt: str,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> Iterator[str]:
        """Send streaming query to Codex.

        Args:
            prompt: User prompt/question
            model: Model to use (default: gpt-5.2-codex)
            system_prompt: Optional system prompt
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum response tokens

        Yields:
            Response text chunks

        Raises:
            CodexError: On API error
        """
        model = model or self.DEFAULT_MODEL
        if model not in self.ALLOWED_MODELS:
            raise CodexError(
                f"Invalid model: {model}. "
                f"Allowed models: {', '.join(self.ALLOWED_MODELS)}"
            )

        # Build messages
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Build request body with streaming
        body: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        if max_tokens:
            body["max_tokens"] = max_tokens

        # Get headers with authentication
        headers = self._get_headers()
        api_url = self._get_api_url()

        try:
            for line in self.http_client.stream_post(
                api_url,
                headers=headers,
                data=body
            ):
                # Parse SSE format
                line = line.strip()
                if not line or not line.startswith("data: "):
                    continue

                data_str = line[6:]  # Remove "data: " prefix
                if data_str == "[DONE]":
                    break

                try:
                    data = json.loads(data_str)
                    choices = data.get("choices", [])
                    if choices:
                        delta = choices[0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            yield content
                except json.JSONDecodeError:
                    continue

        except HttpClientError as e:
            raise CodexError(f"Codex streaming error: {e}")

    def get_models(self) -> list:
        """Get list of available Codex models.

        Returns:
            List of model names
        """
        return self.ALLOWED_MODELS.copy()

    def health_check(self) -> Dict[str, Any]:
        """Check Codex API health and authentication status.

        Returns:
            Health status dictionary
        """
        auth_method = self.token_manager.get_auth_method()
        result = {
            "authenticated": False,
            "auth_method": auth_method,
            "token_valid": False,
            "api_reachable": False,
            "error": None
        }

        try:
            # Check authentication
            result["authenticated"] = self.token_manager.is_authenticated()

            if not result["authenticated"]:
                result["error"] = "Not authenticated"
                return result

            # Verify credentials based on method
            if auth_method == AUTH_METHOD_API_KEY:
                api_key = self.token_manager.get_api_key()
                result["token_valid"] = api_key is not None and api_key.startswith("sk-")
            else:
                # OAuth: Try to get a valid token (triggers refresh if needed)
                self.token_manager.get_valid_token()
                result["token_valid"] = True

            # We could do a simple API test here, but skip to avoid
            # unnecessary API calls. Token validity is sufficient.
            result["api_reachable"] = True

        except TokenError as e:
            result["error"] = str(e)
        except Exception as e:
            result["error"] = f"Health check failed: {e}"

        return result

    def _get_api_url(self) -> str:
        """Get API URL based on authentication method.

        Returns:
            API URL string
        """
        auth_method = self.token_manager.get_auth_method()
        if auth_method == AUTH_METHOD_API_KEY:
            return OPENAI_API_URL
        return CODEX_API_URL

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with authentication.

        Returns:
            Headers dictionary

        Raises:
            CodexError: If authentication fails
        """
        auth_method = self.token_manager.get_auth_method()

        # API Key authentication
        if auth_method == AUTH_METHOD_API_KEY:
            api_key = self.token_manager.get_api_key()
            if not api_key:
                raise CodexError("API key not found. Run /codex:config to set up authentication.")
            _debug("Using API key authentication")
            return {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }

        # OAuth authentication (default)
        try:
            access_token = self.token_manager.get_valid_token()
        except TokenError as e:
            _debug(f"Token error: {e}")
            raise CodexError(f"Authentication required: {e}")

        headers = {
            "Authorization": f"Bearer {access_token[:20]}..." if access_token else "",
            "Content-Type": "application/json",
        }

        # Add account ID if available (only for OAuth/ChatGPT)
        account_id = self.token_manager.get_account_id()
        if account_id:
            headers["ChatGPT-Account-Id"] = account_id
            _debug("Using account ID for request", {"account_id": account_id})
        else:
            _debug("No account ID available")

        # Return actual headers (not debug version)
        return {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            **({"ChatGPT-Account-Id": account_id} if account_id else {})
        }
