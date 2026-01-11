"""PKCE (Proof Key for Code Exchange) generator for OAuth 2.0 security.

Implements RFC 7636 PKCE with S256 code challenge method.
"""

import secrets
import hashlib
import base64
from typing import Tuple


class PKCEGenerator:
    """Generate and validate PKCE code verifier and challenge."""

    # RFC 3986 unreserved characters for code verifier
    UNRESERVED_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"

    @staticmethod
    def generate_verifier(length: int = 43) -> str:
        """Generate cryptographically random code verifier.

        Args:
            length: Length of verifier (43-128 chars per RFC 7636)

        Returns:
            Random string using unreserved characters
        """
        if not 43 <= length <= 128:
            raise ValueError("Verifier length must be between 43 and 128")

        # Use secrets.choice to avoid modulo bias
        chars = PKCEGenerator.UNRESERVED_CHARS
        return "".join(secrets.choice(chars) for _ in range(length))

    @staticmethod
    def generate_challenge(verifier: str) -> str:
        """Generate S256 code challenge from verifier.

        Args:
            verifier: The code verifier string

        Returns:
            Base64URL-encoded SHA256 hash of verifier
        """
        # SHA-256 hash of verifier
        digest = hashlib.sha256(verifier.encode("ascii")).digest()

        # Base64URL encode (no padding)
        challenge = base64.urlsafe_b64encode(digest).decode("ascii")
        return challenge.rstrip("=")

    @staticmethod
    def generate_pair(length: int = 43) -> Tuple[str, str]:
        """Generate verifier and challenge pair.

        Args:
            length: Length of verifier

        Returns:
            Tuple of (verifier, challenge)
        """
        verifier = PKCEGenerator.generate_verifier(length)
        challenge = PKCEGenerator.generate_challenge(verifier)
        return verifier, challenge

    @staticmethod
    def generate_state() -> str:
        """Generate random state parameter for CSRF protection.

        Returns:
            Base64URL-encoded random string
        """
        random_bytes = secrets.token_bytes(32)
        return base64.urlsafe_b64encode(random_bytes).decode("ascii").rstrip("=")

    @staticmethod
    def validate_verifier(verifier: str) -> bool:
        """Validate verifier format per RFC 7636.

        Args:
            verifier: The code verifier to validate

        Returns:
            True if valid, False otherwise
        """
        if not 43 <= len(verifier) <= 128:
            return False
        return all(c in PKCEGenerator.UNRESERVED_CHARS for c in verifier)
