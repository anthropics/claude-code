"""OAuth 2.0 + PKCE flow for OpenAI Codex authentication.

Implements the complete OAuth flow:
1. Generate PKCE verifier and challenge
2. Start local callback server
3. Open browser for user authorization
4. Exchange authorization code for tokens
5. Support token refresh
"""

import http.server
import threading
import webbrowser
import urllib.parse
import time
import base64
from typing import Dict, Any, Optional, Tuple

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    OAUTH_ENDPOINT,
    CLIENT_ID,
    CALLBACK_PORT,
    CALLBACK_PATH,
    REDIRECT_URI,
    OAUTH_SCOPES,
    OAUTH_TIMEOUT,
)
from infrastructure.pkce_generator import PKCEGenerator
from infrastructure.http_client import HttpClient, HttpClientError
from infrastructure.token_storage import TokenStorage


class OAuthError(Exception):
    """OAuth flow error."""
    pass


# Thread-safe result container for OAuth callback
class OAuthResult:
    """Thread-safe container for OAuth callback results."""

    def __init__(self):
        self._lock = threading.Lock()
        self._event = threading.Event()
        self._authorization_code: Optional[str] = None
        self._state_received: Optional[str] = None
        self._error: Optional[str] = None
        self._error_description: Optional[str] = None

    def set_success(self, code: str, state: Optional[str]):
        """Set successful result (thread-safe)."""
        with self._lock:
            self._authorization_code = code
            self._state_received = state
            self._error = None
            self._error_description = None
        self._event.set()

    def set_error(self, error: str, description: Optional[str] = None):
        """Set error result (thread-safe)."""
        with self._lock:
            self._authorization_code = None
            self._state_received = None
            self._error = error
            self._error_description = description
        self._event.set()

    def get_result(self) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
        """Get result (thread-safe). Returns (code, state, error, error_description)."""
        with self._lock:
            return (
                self._authorization_code,
                self._state_received,
                self._error,
                self._error_description
            )

    def wait(self, timeout: float) -> bool:
        """Wait for result. Returns True if result available, False on timeout."""
        return self._event.wait(timeout)

    def reset(self):
        """Reset for new auth flow."""
        with self._lock:
            self._authorization_code = None
            self._state_received = None
            self._error = None
            self._error_description = None
        self._event.clear()


# Global result container (set by OAuthFlow before starting server)
_oauth_result: Optional[OAuthResult] = None


class OAuthCallbackHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler for OAuth callback."""

    def do_GET(self):
        """Handle GET request (OAuth callback)."""
        global _oauth_result

        # Parse query parameters
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == CALLBACK_PATH:
            params = urllib.parse.parse_qs(parsed.query)

            # Check for error
            if "error" in params:
                error = params["error"][0]
                error_desc = params.get("error_description", ["Unknown error"])[0]
                if _oauth_result:
                    _oauth_result.set_error(error, error_desc)
                self._send_error_response(error_desc)
                return

            # Extract code and state
            if "code" in params:
                code = params["code"][0]
                state = params.get("state", [None])[0]
                if _oauth_result:
                    _oauth_result.set_success(code, state)
                self._send_success_response()
            else:
                if _oauth_result:
                    _oauth_result.set_error("missing_code", "Authorization code not found")
                self._send_error_response("Authorization code not found")
        else:
            self.send_error(404, "Not Found")

    def _send_success_response(self):
        """Send success HTML response."""
        html = """<!DOCTYPE html>
<html>
<head>
    <title>Authorization Successful</title>
    <style>
        body { font-family: system-ui, sans-serif; display: flex; justify-content: center;
               align-items: center; height: 100vh; margin: 0; background: #1a1a1a; color: #fff; }
        .container { text-align: center; padding: 2rem; }
        h1 { color: #4ade80; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Authorization Successful</h1>
        <p>You can close this window and return to Claude Code.</p>
    </div>
    <script>setTimeout(() => window.close(), 2000);</script>
</body>
</html>"""
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(html.encode())

    def _send_error_response(self, error_msg: str = "Unknown error"):
        """Send error HTML response."""
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Authorization Failed</title>
    <style>
        body {{ font-family: system-ui, sans-serif; display: flex; justify-content: center;
               align-items: center; height: 100vh; margin: 0; background: #1a1a1a; color: #fff; }}
        .container {{ text-align: center; padding: 2rem; }}
        h1 {{ color: #f87171; }}
        .error {{ color: #fca5a5; font-family: monospace; margin-top: 1rem;
                  padding: 1rem; background: #3b0d0d; border-radius: 0.5rem; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Authorization Failed</h1>
        <div class="error">{error_msg}</div>
    </div>
</body>
</html>"""
        self.send_response(400)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass


class OAuthFlow:
    """Manage OAuth 2.0 + PKCE authentication flow."""

    def __init__(
        self,
        storage: TokenStorage,
        http_client: HttpClient
    ):
        """Initialize OAuth flow.

        Args:
            storage: Token storage instance
            http_client: HTTP client instance
        """
        self.storage = storage
        self.http_client = http_client
        self._server: Optional[http.server.HTTPServer] = None
        self._server_thread: Optional[threading.Thread] = None
        self._result: Optional[OAuthResult] = None

    def start_auth_flow(self, exchange_for_api_key: bool = True) -> Dict[str, Any]:
        """Start complete OAuth flow.

        Args:
            exchange_for_api_key: If True, exchange tokens for an API key
                                  that works with standard OpenAI API endpoints.

        Returns:
            Token dictionary with access_token, refresh_token, and optionally api_key.

        Raises:
            OAuthError: On authentication failure
        """
        global _oauth_result

        # Create thread-safe result container
        self._result = OAuthResult()
        _oauth_result = self._result

        # Generate PKCE pair
        verifier, challenge = PKCEGenerator.generate_pair()
        state = PKCEGenerator.generate_state()

        # Start callback server
        self._start_callback_server()

        try:
            # Build authorization URL
            auth_url = self._build_auth_url(challenge, state)

            # Open browser
            print(f"Opening browser for authentication...")
            print(f"If browser doesn't open, visit: {auth_url}")
            webbrowser.open(auth_url)

            # Wait for callback
            code = self._wait_for_callback(state)

            # Exchange code for tokens
            tokens = self.exchange_code(code, verifier)

            # Optionally exchange for API key
            if exchange_for_api_key and "id_token" in tokens:
                try:
                    api_key = self.exchange_tokens_for_api_key(tokens["id_token"])
                    tokens["openai_api_key"] = api_key
                except OAuthError:
                    # Token exchange failed, continue with OAuth tokens only
                    pass

            # Save tokens
            self.storage.save_tokens(tokens)

            return tokens

        finally:
            self._stop_callback_server()

    def exchange_code(self, code: str, verifier: str) -> Dict[str, Any]:
        """Exchange authorization code for tokens.

        Args:
            code: Authorization code from callback
            verifier: PKCE code verifier

        Returns:
            Token dictionary

        Raises:
            OAuthError: On exchange failure
        """
        try:
            response = self.http_client.post(
                f"{OAUTH_ENDPOINT}/oauth/token",
                form_data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": REDIRECT_URI,
                    "client_id": CLIENT_ID,
                    "code_verifier": verifier,
                }
            )

            # Add timestamp for expiry tracking
            if "expires_in" in response:
                response["expires_at"] = int(time.time()) + response["expires_in"]

            return response

        except HttpClientError as e:
            raise OAuthError(f"Token exchange failed: {e}")

    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh access token using refresh token.

        Args:
            refresh_token: Current refresh token

        Returns:
            New token dictionary

        Raises:
            OAuthError: On refresh failure
        """
        try:
            response = self.http_client.post(
                f"{OAUTH_ENDPOINT}/oauth/token",
                form_data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": CLIENT_ID,
                }
            )

            # Add timestamp for expiry tracking
            if "expires_in" in response:
                response["expires_at"] = int(time.time()) + response["expires_in"]

            # Preserve original refresh_token if not returned
            if "refresh_token" not in response:
                response["refresh_token"] = refresh_token

            return response

        except HttpClientError as e:
            raise OAuthError(f"Token refresh failed: {e}")

    def _build_auth_url(self, challenge: str, state: str) -> str:
        """Build OAuth authorization URL.

        Args:
            challenge: PKCE code challenge
            state: CSRF state parameter

        Returns:
            Complete authorization URL
        """
        params = urllib.parse.urlencode({
            "response_type": "code",
            "client_id": CLIENT_ID,
            "redirect_uri": REDIRECT_URI,
            "scope": OAUTH_SCOPES,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "id_token_add_organizations": "true",
            "codex_cli_simplified_flow": "true",
            "state": state,
        })
        return f"{OAUTH_ENDPOINT}/oauth/authorize?{params}"

    def exchange_tokens_for_api_key(self, id_token: str) -> str:
        """Exchange OAuth tokens for an OpenAI API key.

        Uses the token exchange grant type to obtain an API key that works
        with standard OpenAI API endpoints.

        Args:
            id_token: The id_token from OAuth authentication

        Returns:
            OpenAI API key string

        Raises:
            OAuthError: On exchange failure
        """
        try:
            response = self.http_client.post(
                f"{OAUTH_ENDPOINT}/oauth/token",
                form_data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
                    "client_id": CLIENT_ID,
                    "subject_token_type": "urn:ietf:params:oauth:token-type:id_token",
                    "subject_token": id_token,
                    "requested_token_type": "openai-api-key",
                }
            )

            # The response should contain the API key
            api_key = response.get("access_token") or response.get("api_key")
            if not api_key:
                raise OAuthError("No API key in token exchange response")

            return api_key

        except HttpClientError as e:
            raise OAuthError(f"Token exchange for API key failed: {e}")

    def _start_callback_server(self):
        """Start local HTTP server for OAuth callback."""
        self._server = http.server.HTTPServer(
            ("localhost", CALLBACK_PORT),
            OAuthCallbackHandler
        )
        self._server_thread = threading.Thread(
            target=self._server.serve_forever,
            daemon=True
        )
        self._server_thread.start()

    def _stop_callback_server(self):
        """Stop callback server."""
        if self._server:
            self._server.shutdown()
            self._server = None
        if self._server_thread:
            self._server_thread.join(timeout=1)
            self._server_thread = None

    def _wait_for_callback(self, expected_state: str) -> str:
        """Wait for OAuth callback with authorization code.

        Args:
            expected_state: Expected state parameter for CSRF validation

        Returns:
            Authorization code

        Raises:
            OAuthError: On callback error or timeout
        """
        if not self._result:
            raise OAuthError("OAuth result container not initialized")

        # Wait for result with timeout
        if not self._result.wait(OAUTH_TIMEOUT):
            raise OAuthError(
                "OAuth timeout - authorization took too long. "
                "Please try again."
            )

        # Get result thread-safely
        code, state, error, error_desc = self._result.get_result()

        # Check for error
        if error:
            raise OAuthError(f"Authorization error: {error} - {error_desc}")

        # Validate code exists
        if not code:
            raise OAuthError("Authorization code not received")

        # Validate state (CSRF protection)
        if state != expected_state:
            raise OAuthError("Invalid state parameter - potential CSRF attack")

        return code
