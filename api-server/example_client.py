"""
Example client for Claude Code API Server.

This script demonstrates how to interact with the API server.
"""

import requests
import sys
import json
from typing import Optional


class ClaudeAPIClient:
    """Simple client for Claude Code API."""

    def __init__(self, base_url: str, api_key: Optional[str] = None):
        """
        Initialize the client.

        Args:
            base_url: Base URL of the API server (e.g., http://localhost:8000)
            api_key: API key for authentication (optional if auth is disabled)
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.headers = {'Content-Type': 'application/json'}
        if api_key:
            self.headers['X-API-Key'] = api_key

    def health_check(self) -> dict:
        """Check if the API server is healthy."""
        response = requests.get(f"{self.base_url}/health")
        response.raise_for_status()
        return response.json()

    def execute(
        self,
        prompt: str,
        working_directory: Optional[str] = None,
        timeout: int = 300,
        env_vars: Optional[dict] = None
    ) -> dict:
        """
        Execute a Claude Code command and get the complete response.

        Args:
            prompt: The task/command for Claude Code
            working_directory: Directory to execute in (optional)
            timeout: Timeout in seconds
            env_vars: Additional environment variables (optional)

        Returns:
            Dictionary with execution results
        """
        payload = {
            'prompt': prompt,
            'timeout': timeout
        }
        if working_directory:
            payload['working_directory'] = working_directory
        if env_vars:
            payload['env_vars'] = env_vars

        response = requests.post(
            f"{self.base_url}/api/execute",
            headers=self.headers,
            json=payload
        )
        response.raise_for_status()
        return response.json()

    def execute_stream(
        self,
        prompt: str,
        working_directory: Optional[str] = None,
        env_vars: Optional[dict] = None
    ):
        """
        Execute a Claude Code command and stream the response.

        Args:
            prompt: The task/command for Claude Code
            working_directory: Directory to execute in (optional)
            env_vars: Additional environment variables (optional)

        Yields:
            Lines of output as they become available
        """
        payload = {'prompt': prompt}
        if working_directory:
            payload['working_directory'] = working_directory
        if env_vars:
            payload['env_vars'] = env_vars

        response = requests.post(
            f"{self.base_url}/api/execute/stream",
            headers=self.headers,
            json=payload,
            stream=True
        )
        response.raise_for_status()

        for line in response.iter_lines():
            if line:
                yield line.decode('utf-8')


def main():
    """Example usage of the Claude API client."""
    # Configuration
    API_URL = "http://localhost:8000"
    API_KEY = None  # Set this if authentication is enabled

    # Create client
    client = ClaudeAPIClient(API_URL, API_KEY)

    print("Claude Code API Client Example")
    print("=" * 50)
    print()

    # 1. Health check
    print("1. Checking API health...")
    try:
        health = client.health_check()
        print(f"   Status: {health['status']}")
        print(f"   Version: {health['version']}")
        print(f"   Claude Code Available: {health['claude_code_available']}")
        print()
    except Exception as e:
        print(f"   Error: {e}")
        print("   Make sure the server is running!")
        sys.exit(1)

    # 2. Execute a simple command
    print("2. Executing a simple command...")
    try:
        result = client.execute(
            prompt="What is 2 + 2?",
            timeout=30
        )
        print(f"   Success: {result['success']}")
        print(f"   Execution Time: {result['execution_time']:.2f}s")
        print(f"   Output Preview: {result['output'][:100]}...")
        print()
    except Exception as e:
        print(f"   Error: {e}")
        print()

    # 3. Execute with streaming
    print("3. Executing with streaming output...")
    print("   " + "-" * 46)
    try:
        for line in client.execute_stream(
            prompt="List the current directory"
        ):
            print(f"   {line}", end='')
    except Exception as e:
        print(f"   Error: {e}")
    print()
    print("   " + "-" * 46)
    print()

    print("Example completed!")
    print()
    print("Try modifying this script to test different prompts and options.")


if __name__ == "__main__":
    main()
