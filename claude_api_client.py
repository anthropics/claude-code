#!/usr/bin/env python3
"""
Claude API Client - A simple Python script to send requests to Claude API
similar to how Claude Code authenticates and makes requests.

This script demonstrates the authentication mechanism used by Claude Code
when communicating with the Anthropic Claude API.

Usage:
    export ANTHROPIC_API_KEY="your-api-key-here"
    python claude_api_client.py

Author: Generated for educational purposes
"""

import os
import json
import sys
from typing import Dict, List, Optional, Any
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


class ClaudeAPIClient:
    """
    A simple client for interacting with the Anthropic Claude API.

    This mimics the authentication and request patterns used by Claude Code.
    """

    # API Configuration
    API_BASE_URL = "https://api.anthropic.com/v1"
    API_VERSION = "2023-06-01"
    DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
    DEFAULT_MAX_TOKENS = 4096

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Claude API client.

        Args:
            api_key: Anthropic API key. If not provided, will try to read from
                    ANTHROPIC_API_KEY environment variable.

        Raises:
            ValueError: If no API key is provided or found in environment.
        """
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")

        if not self.api_key:
            raise ValueError(
                "No API key provided. Please set ANTHROPIC_API_KEY environment "
                "variable or pass api_key parameter."
            )

    def _build_headers(self, additional_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """
        Build request headers following Claude Code's authentication pattern.

        Args:
            additional_headers: Optional additional headers to include.

        Returns:
            Dictionary of HTTP headers.
        """
        headers = {
            # Authentication header - This is how Claude Code authenticates
            "x-api-key": self.api_key,

            # API version header - Required by Anthropic API
            "anthropic-version": self.API_VERSION,

            # Content type
            "Content-Type": "application/json",

            # User agent (similar to how Claude Code identifies itself)
            "User-Agent": "claude-api-client-python/1.0"
        }

        if additional_headers:
            headers.update(additional_headers)

        return headers

    def send_message(
        self,
        message: str,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        system: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 1.0,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send a message to Claude and get a response.

        Args:
            message: The user message to send to Claude.
            model: The model to use (default: claude-sonnet-4-5-20250929).
            max_tokens: Maximum tokens in response (default: 4096).
            system: Optional system prompt.
            conversation_history: Optional list of previous messages.
            temperature: Sampling temperature (0-1).
            **kwargs: Additional parameters to pass to the API.

        Returns:
            Dictionary containing the API response.

        Raises:
            HTTPError: If the API request fails.
        """
        model = model or self.DEFAULT_MODEL
        max_tokens = max_tokens or self.DEFAULT_MAX_TOKENS

        # Build the messages array
        messages = conversation_history.copy() if conversation_history else []
        messages.append({
            "role": "user",
            "content": message
        })

        # Build the request body
        request_body = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": messages,
            "temperature": temperature,
            **kwargs
        }

        # Add system prompt if provided
        if system:
            request_body["system"] = system

        # Make the API request
        return self._make_request("/messages", request_body)

    def _make_request(self, endpoint: str, body: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make an HTTP request to the Anthropic API.

        Args:
            endpoint: API endpoint (e.g., "/messages").
            body: Request body as a dictionary.

        Returns:
            Dictionary containing the parsed JSON response.

        Raises:
            HTTPError: If the request fails.
        """
        url = f"{self.API_BASE_URL}{endpoint}"
        headers = self._build_headers()

        # Encode request body
        data = json.dumps(body).encode('utf-8')

        # Create request
        request = Request(url, data=data, headers=headers, method='POST')

        try:
            # Send request
            with urlopen(request) as response:
                response_data = response.read().decode('utf-8')
                return json.loads(response_data)

        except HTTPError as e:
            error_body = e.read().decode('utf-8')
            print(f"HTTP Error {e.code}: {e.reason}", file=sys.stderr)
            print(f"Response: {error_body}", file=sys.stderr)
            raise

        except URLError as e:
            print(f"URL Error: {e.reason}", file=sys.stderr)
            raise


def pretty_print_response(response: Dict[str, Any]) -> None:
    """
    Pretty print the Claude API response.

    Args:
        response: The API response dictionary.
    """
    print("\n" + "="*70)
    print("CLAUDE API RESPONSE")
    print("="*70)

    # Print model info
    print(f"\nModel: {response.get('model', 'unknown')}")
    print(f"Stop Reason: {response.get('stop_reason', 'unknown')}")

    # Print usage statistics
    usage = response.get('usage', {})
    print(f"\nTokens Used:")
    print(f"  Input: {usage.get('input_tokens', 0)}")
    print(f"  Output: {usage.get('output_tokens', 0)}")

    # Print the actual response content
    print(f"\nResponse Content:")
    print("-"*70)

    content = response.get('content', [])
    for item in content:
        if item.get('type') == 'text':
            print(item.get('text', ''))

    print("="*70 + "\n")


def main():
    """
    Main function demonstrating usage of the Claude API client.
    """
    print("Claude Code Authentication Mechanism Demo")
    print("==========================================\n")

    # Check for API key
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY environment variable not set.", file=sys.stderr)
        print("\nTo use this script, you need to set your API key:", file=sys.stderr)
        print("  export ANTHROPIC_API_KEY='your-api-key-here'", file=sys.stderr)
        print("\nYou can get an API key from: https://console.anthropic.com/", file=sys.stderr)
        sys.exit(1)

    # Initialize the client
    print("Initializing Claude API client...")
    client = ClaudeAPIClient(api_key=api_key)

    # Example 1: Simple message
    print("\n--- Example 1: Simple Message ---")
    try:
        response = client.send_message(
            message="Hello! Can you explain what you are in one sentence?",
            max_tokens=200
        )
        pretty_print_response(response)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return

    # Example 2: Message with system prompt
    print("\n--- Example 2: Message with System Prompt ---")
    try:
        response = client.send_message(
            message="What's the weather like?",
            system="You are a helpful assistant that always responds in a concise manner.",
            max_tokens=100
        )
        pretty_print_response(response)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return

    # Example 3: Multi-turn conversation
    print("\n--- Example 3: Multi-turn Conversation ---")
    try:
        conversation = [
            {"role": "user", "content": "My name is Alex."},
            {"role": "assistant", "content": "Nice to meet you, Alex! How can I help you today?"}
        ]

        response = client.send_message(
            message="What's my name?",
            conversation_history=conversation,
            max_tokens=100
        )
        pretty_print_response(response)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return

    print("\nDemo completed successfully!")
    print("\nAuthentication Details:")
    print("- Method: API Key via x-api-key header")
    print("- API Version: 2023-06-01 (anthropic-version header)")
    print("- Endpoint: https://api.anthropic.com/v1/messages")


if __name__ == "__main__":
    main()
