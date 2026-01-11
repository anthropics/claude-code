"""Token lifecycle management for Codex OAuth.

Handles token retrieval, validation, and automatic refresh.
"""

import time
import base64
import json
from typing import Dict, Any, Optional

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import TOKEN_REFRESH_BUFFER, AUTH_METHOD_OAUTH, AUTH_METHOD_API_KEY
from infrastructure.token_storage import TokenStorage
from services.oauth_flow import OAuthFlow, OAuthError


class TokenError(Exception):
    """Token management error."""
    pass


class TokenManager:
    """Manage OAuth token lifecycle with auto-refresh."""

    def __init__(self, storage: TokenStorage, oauth_flow: OAuthFlow):
        """Initialize token manager.

        Args:
            storage: Token storage instance
            oauth_flow: OAuth flow instance for refresh operations
        """
        self.storage = storage
        self.oauth_flow = oauth_flow
        self._cached_tokens: Optional[Dict[str, Any]] = None

    def get_valid_token(self) -> str:
        """Get valid access token, refreshing if needed.

        Returns:
            Valid access token string

        Raises:
            TokenError: If no tokens available or refresh fails
        """
        tokens = self._get_tokens()

        if not tokens:
            raise TokenError(
                "Not authenticated. Please run /codex-config to authenticate."
            )

        access_token = tokens.get("access_token")
        if not access_token:
            raise TokenError("Invalid token data - missing access_token")

        # Check if token needs refresh
        if self._is_token_expired(tokens):
            tokens = self._refresh_tokens(tokens)
            access_token = tokens.get("access_token")

        return access_token

    def get_account_id(self) -> Optional[str]:
        """Extract ChatGPT account ID from tokens.

        Returns:
            Account ID string or None
        """
        tokens = self._get_tokens()
        if not tokens:
            return None

        # Try to extract from id_token
        id_token = tokens.get("id_token")
        if id_token:
            account_id = self._extract_account_id_from_jwt(id_token)
            if account_id:
                return account_id

        # Try from access_token
        access_token = tokens.get("access_token")
        if access_token:
            return self._extract_account_id_from_jwt(access_token)

        return None

    def clear_tokens(self) -> None:
        """Clear all stored tokens."""
        self.storage.delete_tokens()
        self._cached_tokens = None

    # API Key methods
    def set_api_key(self, api_key: str) -> None:
        """Set API key for authentication.

        Args:
            api_key: OpenAI API key (sk-...)

        Raises:
            TokenError: If API key is invalid format
        """
        if not api_key or not api_key.startswith("sk-"):
            raise TokenError("Invalid API key format. Must start with 'sk-'")
        self.storage.save_api_key(api_key)
        self._cached_tokens = None

    def get_api_key(self) -> Optional[str]:
        """Get stored API key.

        First checks for directly stored API key, then checks for
        API key obtained through OAuth token exchange.

        Returns:
            API key string or None
        """
        # Check for directly stored API key
        api_key = self.storage.load_api_key()
        if api_key:
            return api_key

        # Check for API key from OAuth token exchange
        tokens = self._get_tokens()
        if tokens and "openai_api_key" in tokens:
            return tokens["openai_api_key"]

        return None

    def get_auth_method(self) -> Optional[str]:
        """Get current authentication method.

        Returns:
            'oauth' or 'api_key' or None
        """
        return self.storage.get_auth_method()

    def is_authenticated(self) -> bool:
        """Check if valid credentials exist (OAuth or API key).

        Returns:
            True if authenticated, False otherwise
        """
        # Check for any API key (direct or from OAuth token exchange)
        api_key = self.get_api_key()
        if api_key:
            return True

        # Check for OAuth tokens
        tokens = self._get_tokens()
        if tokens and "access_token" in tokens:
            return True

        return False

    def clear_all(self) -> None:
        """Clear all stored credentials (OAuth and API key)."""
        self.storage.clear_all()
        self._cached_tokens = None

    def get_token_info(self) -> Dict[str, Any]:
        """Get token/auth status information.

        Returns:
            Dictionary with authentication status details
        """
        # Check for direct API key first
        direct_api_key = self.storage.load_api_key()
        if direct_api_key:
            masked = direct_api_key[:7] + "..." + direct_api_key[-4:] if len(direct_api_key) > 15 else "sk-***"
            return {
                "authenticated": True,
                "auth_method": AUTH_METHOD_API_KEY,
                "api_key_masked": masked,
                "message": f"Using API key: {masked}"
            }

        # Check OAuth tokens
        tokens = self._get_tokens()

        if not tokens:
            return {
                "authenticated": False,
                "auth_method": None,
                "message": "Not authenticated"
            }

        # Check if OAuth provided an API key via token exchange
        oauth_api_key = tokens.get("openai_api_key")
        if oauth_api_key:
            masked = oauth_api_key[:7] + "..." + oauth_api_key[-4:] if len(oauth_api_key) > 15 else "***"
            return {
                "authenticated": True,
                "auth_method": AUTH_METHOD_OAUTH,
                "has_api_key": True,
                "api_key_masked": masked,
                "account_id": self.get_account_id(),
                "message": f"Authenticated via ChatGPT subscription (API key: {masked})"
            }

        # OAuth without token exchange - use access_token directly
        expires_at = tokens.get("expires_at", 0)
        now = int(time.time())
        expires_in = max(0, expires_at - now)

        return {
            "authenticated": True,
            "auth_method": AUTH_METHOD_OAUTH,
            "has_api_key": False,
            "expires_in_seconds": expires_in,
            "expires_at": expires_at,
            "has_refresh_token": "refresh_token" in tokens,
            "account_id": self.get_account_id(),
            "is_expired": expires_in <= 0,
            "needs_refresh": expires_in < TOKEN_REFRESH_BUFFER
        }

    def force_refresh(self) -> Dict[str, Any]:
        """Force refresh of access token.

        Returns:
            New token dictionary

        Raises:
            TokenError: If refresh fails
        """
        tokens = self._get_tokens()
        if not tokens:
            raise TokenError("No tokens to refresh")

        return self._refresh_tokens(tokens)

    def _get_tokens(self) -> Optional[Dict[str, Any]]:
        """Get tokens from cache or storage.

        Returns:
            Token dictionary or None
        """
        if self._cached_tokens is None:
            self._cached_tokens = self.storage.load_tokens()
        return self._cached_tokens

    def _is_token_expired(self, tokens: Dict[str, Any]) -> bool:
        """Check if token is expired or near expiry.

        Args:
            tokens: Token dictionary

        Returns:
            True if token should be refreshed
        """
        expires_at = tokens.get("expires_at", 0)
        now = int(time.time())

        # Refresh if expired or within buffer period
        return (expires_at - now) < TOKEN_REFRESH_BUFFER

    def _refresh_tokens(self, tokens: Dict[str, Any]) -> Dict[str, Any]:
        """Refresh access token.

        Args:
            tokens: Current token dictionary

        Returns:
            New token dictionary

        Raises:
            TokenError: If refresh fails
        """
        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            # Clear cache since we can't refresh
            self._cached_tokens = None
            raise TokenError(
                "No refresh token available. Please re-authenticate with /codex-config"
            )

        try:
            new_tokens = self.oauth_flow.refresh_access_token(refresh_token)
            self.storage.save_tokens(new_tokens)
            self._cached_tokens = new_tokens
            return new_tokens
        except OAuthError as e:
            # Clear cache on refresh failure to force re-read from storage
            # or re-authentication on next attempt
            self._cached_tokens = None
            raise TokenError(f"Token refresh failed: {e}")

    def _extract_account_id_from_jwt(self, token: str) -> Optional[str]:
        """Extract ChatGPT account ID from JWT token.

        Args:
            token: JWT token string

        Returns:
            Account ID or None
        """
        try:
            # JWT format: header.payload.signature
            parts = token.split(".")
            if len(parts) != 3:
                return None

            # Decode payload (add padding if needed)
            payload = parts[1]
            padding = 4 - len(payload) % 4
            if padding != 4:
                payload += "=" * padding

            decoded = base64.urlsafe_b64decode(payload)
            claims = json.loads(decoded)

            # Try different claim locations (based on OpenCode implementation)
            account_id = claims.get("chatgpt_account_id")
            if account_id:
                return account_id

            # Check nested location
            auth_claims = claims.get("https://api.openai.com/auth", {})
            account_id = auth_claims.get("chatgpt_account_id")
            if account_id:
                return account_id

            # Check organizations
            orgs = claims.get("organizations", [])
            if orgs and isinstance(orgs, list) and len(orgs) > 0:
                return orgs[0].get("id")

            return None

        except Exception:
            return None
