"""Codex API client for making queries.

Handles API requests to OpenAI Codex endpoint with authentication.
"""

import json
import sys
import os
from typing import Dict, Any, Optional, Iterator

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import CODEX_API_URL, CODEX_MODELS_URL, OPENAI_API_URL, DEBUG, AUTH_METHOD_OAUTH, AUTH_METHOD_API_KEY, CLIENT_VERSION
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

    # Fallback models (used when API fetch fails)
    FALLBACK_MODELS = [
        "gpt-5.1-codex-max",
        "gpt-5.1-codex-mini",
        "gpt-5.2",
        "gpt-5.2-codex"
    ]

    # For backwards compatibility
    ALLOWED_MODELS = FALLBACK_MODELS

    DEFAULT_MODEL = "gpt-5.2-codex"

    # Valid reasoning effort levels
    REASONING_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh"]
    DEFAULT_REASONING_EFFORT = "medium"

    def __init__(self, token_manager: TokenManager, http_client: HttpClient):
        """Initialize Codex client.

        Args:
            token_manager: Token manager for authentication
            http_client: HTTP client for requests
        """
        self.token_manager = token_manager
        self.http_client = http_client

    # Default system instructions for Codex
    DEFAULT_INSTRUCTIONS = "You are a helpful AI coding assistant. Provide clear, concise, and accurate responses."

    def query(
        self,
        prompt: str,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        messages: Optional[list] = None,
        reasoning_effort: Optional[str] = None
    ) -> str:
        """Send query to Codex and return response.

        Args:
            prompt: User prompt/question
            model: Model to use (default: gpt-5.2-codex)
            system_prompt: Optional system prompt (used as instructions)
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum response tokens
            messages: Previous conversation messages for context
            reasoning_effort: Reasoning effort level (none/minimal/low/medium/high/xhigh)

        Returns:
            Codex response text

        Raises:
            CodexError: On API error
        """
        model = model or self.DEFAULT_MODEL

        # Validate reasoning effort if provided
        if reasoning_effort and reasoning_effort.lower() not in self.REASONING_EFFORTS:
            raise CodexError(
                f"Invalid reasoning effort: {reasoning_effort}. "
                f"Valid values: {', '.join(self.REASONING_EFFORTS)}"
            )

        # Get API URL to determine request format
        api_url = self._get_api_url()

        # Use different request format based on API endpoint
        if api_url == CODEX_API_URL:
            # ChatGPT Responses API format
            body = self._build_responses_api_request(
                prompt, model, system_prompt, messages, reasoning_effort
            )
        else:
            # Standard OpenAI Chat Completions API format
            body = self._build_chat_api_request(
                prompt, model, system_prompt, temperature, max_tokens, messages
            )

        # Get headers with authentication
        try:
            headers = self._get_headers()
        except CodexError as e:
            _debug(f"Failed to get headers: {e}")
            raise

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

            # Extract response based on API type
            if api_url == CODEX_API_URL:
                return self._parse_responses_api_response(response)
            else:
                return self._parse_chat_api_response(response)

        except HttpClientError as e:
            _debug(f"HTTP client error: {e}")
            raise CodexError(f"Codex API error: {e}")
        except CodexError:
            raise
        except Exception as e:
            _debug(f"Unexpected error: {type(e).__name__}: {e}")
            raise CodexError(f"Unexpected error: {e}")

    def _build_responses_api_request(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str],
        messages: Optional[list],
        reasoning_effort: Optional[str] = None
    ) -> Dict[str, Any]:
        """Build request body for ChatGPT Responses API format.

        Responses API uses:
        - input: array of message items (role + content format)
        - reasoning: optional reasoning configuration

        Input format:
        - User: {"role": "user", "content": [{"type": "input_text", "text": "..."}]}
        - Assistant: {"role": "assistant", "content": [{"type": "output_text", "text": "..."}]}
        - System: {"role": "developer", "content": "..."} (string, not array)
        """
        # Build input array
        input_items = []

        # Add system prompt as first message if provided
        # The system prompt is included in the input array, not as separate "instructions" field
        if system_prompt:
            input_items.append({
                "role": "developer",
                "content": system_prompt
            })

        # Add previous messages if provided
        if messages:
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "assistant":
                    # Assistant messages use output_text (NO type wrapper)
                    input_items.append({
                        "role": "assistant",
                        "content": [{"type": "output_text", "text": content}]
                    })
                elif role == "system":
                    # System messages use developer role with string content (NO type wrapper)
                    input_items.append({
                        "role": "developer",
                        "content": content
                    })
                else:
                    # User messages use input_text (NO type wrapper)
                    input_items.append({
                        "role": "user",
                        "content": [{"type": "input_text", "text": content}]
                    })

        # Add current user prompt (NO type wrapper)
        input_items.append({
            "role": "user",
            "content": [{"type": "input_text", "text": prompt}]
        })

        body: Dict[str, Any] = {
            "model": model,
            "input": input_items,
        }

        # Add reasoning configuration if specified
        if reasoning_effort:
            body["reasoning"] = {
                "effort": reasoning_effort.lower()
            }

        return body

    def _build_chat_api_request(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: Optional[int],
        messages: Optional[list]
    ) -> Dict[str, Any]:
        """Build request body for standard OpenAI Chat Completions API format."""
        all_messages = []

        if system_prompt:
            all_messages.append({"role": "system", "content": system_prompt})

        if messages:
            all_messages.extend(messages)

        all_messages.append({"role": "user", "content": prompt})

        body: Dict[str, Any] = {
            "model": model,
            "messages": all_messages,
            "temperature": temperature,
        }
        if max_tokens:
            body["max_tokens"] = max_tokens

        return body

    def _parse_responses_api_response(self, response: Any) -> str:
        """Parse response from ChatGPT Responses API format."""
        if not isinstance(response, dict):
            _debug(f"Unexpected response type: {type(response)}")
            raise CodexError(f"Unexpected response format: {type(response)}")

        # Responses API returns output array
        output = response.get("output", [])
        if not output:
            _debug("No output in response", response)
            raise CodexError(f"No response from Codex. Response: {json.dumps(response)[:200]}")

        # Extract text from output items
        text_parts = []
        for item in output:
            if item.get("type") == "message":
                content = item.get("content", [])
                for part in content:
                    if part.get("type") == "output_text":
                        text_parts.append(part.get("text", ""))

        if text_parts:
            result = "".join(text_parts)
            _debug(f"Extracted content from output: {len(result)} chars")
            return result

        _debug("Could not extract content from output", output)
        raise CodexError(f"Could not extract response content: {json.dumps(output)[:200]}")

    def _parse_chat_api_response(self, response: Any) -> str:
        """Parse response from standard OpenAI Chat Completions API format."""
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
        """Get list of available Codex models (static fallback list).

        Returns:
            List of model names
        """
        return self.FALLBACK_MODELS.copy()

    def fetch_models_from_api(self) -> Dict[str, Any]:
        """Fetch available models dynamically from the Codex API.

        Returns:
            Dictionary with models array containing full model info including
            supported reasoning efforts.

        Raises:
            CodexError: On API error
        """
        try:
            headers = self._get_headers()
        except CodexError as e:
            _debug(f"Failed to get headers for models API: {e}")
            raise

        # Build URL with client version
        url = f"{CODEX_MODELS_URL}?client_version={CLIENT_VERSION}"

        _debug("Fetching models from API", {"url": url})

        try:
            response = self.http_client.get(url, headers=headers)

            if not isinstance(response, dict):
                _debug(f"Unexpected models response type: {type(response)}")
                raise CodexError(f"Unexpected response format: {type(response)}")

            models = response.get("models", [])
            _debug(f"Fetched {len(models)} models from API")

            # Transform to simplified format with reasoning info
            result = []
            for model in models:
                model_info = {
                    "id": model.get("slug"),
                    "display_name": model.get("display_name"),
                    "description": model.get("description"),
                    "default_reasoning_effort": model.get("default_reasoning_level", "medium"),
                    "supported_reasoning_efforts": model.get("supported_reasoning_levels", []),
                    "visibility": model.get("visibility", "list"),
                    "priority": model.get("priority", 0),
                    "supported_in_api": model.get("supported_in_api", False)
                }
                result.append(model_info)

            # Sort by priority (higher priority first)
            result.sort(key=lambda x: x.get("priority", 0), reverse=True)

            return {
                "models": result,
                "source": "api"
            }

        except HttpClientError as e:
            _debug(f"HTTP client error fetching models: {e}")
            # Fall back to static list
            return {
                "models": [{"id": m, "display_name": m} for m in self.FALLBACK_MODELS],
                "source": "fallback",
                "error": str(e)
            }
        except Exception as e:
            _debug(f"Unexpected error fetching models: {e}")
            return {
                "models": [{"id": m, "display_name": m} for m in self.FALLBACK_MODELS],
                "source": "fallback",
                "error": str(e)
            }

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

        If we have an API key (direct or from OAuth token exchange),
        use the standard OpenAI API endpoint. Otherwise, use ChatGPT backend.

        Returns:
            API URL string
        """
        # Check for API key (includes OAuth-exchanged key)
        api_key = self.token_manager.get_api_key()
        if api_key:
            return OPENAI_API_URL

        # Fall back to ChatGPT backend for OAuth without token exchange
        return CODEX_API_URL

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with authentication.

        Returns:
            Headers dictionary

        Raises:
            CodexError: If authentication fails
        """
        # Check for API key (includes OAuth-exchanged key)
        api_key = self.token_manager.get_api_key()
        if api_key:
            _debug("Using API key authentication")
            return {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }

        # OAuth authentication without token exchange (use access_token directly)
        try:
            access_token = self.token_manager.get_valid_token()
        except TokenError as e:
            _debug(f"Token error: {e}")
            raise CodexError(f"Authentication required: {e}")

        headers = {
            "Authorization": f"Bearer {access_token[:20]}..." if access_token else "",
            "Content-Type": "application/json",
        }

        # Add account ID if available (only for ChatGPT backend)
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
