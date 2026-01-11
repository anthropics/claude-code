#!/usr/bin/env python3
"""Test script to diagnose Codex API issues."""

import sys
import os
import json

# Add MCP server to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'plugins/codex-oauth/servers/codex-mcp-server'))

from infrastructure.http_client import HttpClient
from infrastructure.token_storage import TokenStorage
from services.token_manager import TokenManager
from services.oauth_flow import OAuthFlow

def test_auth():
    """Test authentication and API call."""
    storage = TokenStorage()
    http_client = HttpClient()
    oauth_flow = OAuthFlow(storage, http_client)
    token_manager = TokenManager(storage, oauth_flow)

    # Check if authenticated
    if not token_manager.is_authenticated():
        print("Error: Not authenticated. Please run /codex-config first.")
        print("\nTo test, you need to:")
        print("1. Have valid OAuth tokens in ~/.claude/auth.json")
        print("2. Or run /codex-oauth:codex-config in Claude Code first")
        return

    # Get valid token
    try:
        access_token = token_manager.get_valid_token()
        account_id = token_manager.get_account_id()

        print(f"✓ Authenticated")
        print(f"  Access token: {access_token[:20]}...")
        print(f"  Account ID: {account_id}")

        # Try a simple API call
        print("\nAttempting API call to Codex endpoint...")

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        if account_id:
            headers["ChatGPT-Account-Id"] = account_id

        body = {
            "model": "gpt-5.2-codex",
            "messages": [
                {"role": "user", "content": "How many characters in the word 'hello'?"}
            ],
            "temperature": 0.7
        }

        print(f"\nRequest:")
        print(f"  URL: https://chatgpt.com/backend-api/codex/responses")
        print(f"  Headers: {json.dumps({k: v[:20] + '...' if len(v) > 20 else v for k, v in headers.items()}, indent=2)}")
        print(f"  Body: {json.dumps(body, indent=2)}")

        response = http_client.post(
            "https://chatgpt.com/backend-api/codex/responses",
            headers=headers,
            data=body
        )

        print(f"\n✓ API Response:")
        print(json.dumps(response, indent=2))

        # Try to extract response text
        if "choices" in response:
            print("\nExtracted response:")
            for i, choice in enumerate(response["choices"]):
                if "message" in choice:
                    print(f"  Choice {i}: {choice['message'].get('content', 'No content')}")
                elif "delta" in choice:
                    print(f"  Choice {i} (delta): {choice['delta'].get('content', 'No content')}")

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_auth()
