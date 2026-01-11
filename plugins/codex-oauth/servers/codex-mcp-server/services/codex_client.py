"""Codex API client for making queries.

Handles API requests to OpenAI Codex endpoint with authentication.
"""

import json
from typing import Dict, Any, Optional, Iterator

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import CODEX_API_URL
from infrastructure.http_client import HttpClient, HttpClientError
from services.token_manager import TokenManager, TokenError


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
        max_tokens: Optional[int] = None
    ) -> str:
        """Send query to Codex and return response.

        Args:
            prompt: User prompt/question
            model: Model to use (default: gpt-5.2-codex)
            system_prompt: Optional system prompt
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum response tokens

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

        # Build messages
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Build request body
        body: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens:
            body["max_tokens"] = max_tokens

        # Get headers with authentication
        headers = self._get_headers()

        try:
            response = self.http_client.post(
                CODEX_API_URL,
                headers=headers,
                data=body
            )

            # Extract response text
            choices = response.get("choices", [])
            if not choices:
                raise CodexError("No response from Codex")

            message = choices[0].get("message", {})
            content = message.get("content", "")

            return content

        except HttpClientError as e:
            raise CodexError(f"Codex API error: {e}")

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

        try:
            for line in self.http_client.stream_post(
                CODEX_API_URL,
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
        result = {
            "authenticated": False,
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

            # Try to get a valid token (triggers refresh if needed)
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

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with authentication.

        Returns:
            Headers dictionary

        Raises:
            CodexError: If authentication fails
        """
        try:
            access_token = self.token_manager.get_valid_token()
        except TokenError as e:
            raise CodexError(f"Authentication required: {e}")

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        # Add account ID if available
        account_id = self.token_manager.get_account_id()
        if account_id:
            headers["ChatGPT-Account-Id"] = account_id

        return headers
