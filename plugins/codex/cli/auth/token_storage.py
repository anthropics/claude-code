"""Secure token storage for OAuth credentials.

Stores tokens in ~/.claude/auth.json with 0600 permissions.
Cross-platform compatible (Unix/Windows).
"""

import json
import os
import tempfile
import sys
from typing import Optional, Dict, Any
from pathlib import Path

# Cross-platform file locking
if sys.platform == "win32":
    import msvcrt
    def _lock_file(f, exclusive: bool = False):
        """Lock file on Windows."""
        msvcrt.locking(f.fileno(), msvcrt.LK_LOCK if exclusive else msvcrt.LK_RLCK, 1)

    def _unlock_file(f):
        """Unlock file on Windows."""
        msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
else:
    import fcntl
    def _lock_file(f, exclusive: bool = False):
        """Lock file on Unix."""
        fcntl.flock(f.fileno(), fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH)

    def _unlock_file(f):
        """Unlock file on Unix."""
        fcntl.flock(f.fileno(), fcntl.LOCK_UN)

# Import config
import sys as _sys
import os as _os
_cli_dir = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if _cli_dir not in _sys.path:
    _sys.path.insert(0, _cli_dir)
from config import AUTH_FILE_PATH, TOKEN_KEY, AUTH_METHOD_OAUTH, AUTH_METHOD_API_KEY

# Storage keys
API_KEY_STORAGE_KEY = "openai_api_key"
AUTH_METHOD_KEY = "auth_method"


class TokenStorage:
    """Thread-safe file-based token storage with secure permissions."""

    def __init__(self, auth_file: str = AUTH_FILE_PATH, token_key: str = TOKEN_KEY):
        """Initialize token storage.

        Args:
            auth_file: Path to auth.json file
            token_key: Key under which to store Codex tokens
        """
        self.auth_file = Path(auth_file).expanduser()
        self.token_key = token_key

    def save_tokens(self, tokens: Dict[str, Any]) -> None:
        """Save tokens atomically with 0600 permissions.

        Args:
            tokens: Token dictionary containing access_token, refresh_token, etc.
        """
        # Ensure directory exists with secure permissions
        self.auth_file.parent.mkdir(parents=True, exist_ok=True)
        if sys.platform != "win32":
            os.chmod(self.auth_file.parent, 0o700)

        # Load existing data
        existing = self._load_all() or {}
        existing[self.token_key] = tokens
        existing[AUTH_METHOD_KEY] = AUTH_METHOD_OAUTH

        # Write atomically (temp file + rename)
        # Use restrictive umask on Unix to ensure temp file is created securely
        dir_path = self.auth_file.parent
        old_umask = None
        if sys.platform != "win32":
            old_umask = os.umask(0o077)  # Only owner can read/write

        try:
            fd, temp_path = tempfile.mkstemp(dir=str(dir_path), suffix=".tmp")
            try:
                # On Unix, explicitly set permissions before writing
                if sys.platform != "win32":
                    os.fchmod(fd, 0o600)

                with os.fdopen(fd, "w") as f:
                    json.dump(existing, f, indent=2)

                # Atomic rename
                os.rename(temp_path, self.auth_file)

                # Ensure final file has correct permissions
                if sys.platform != "win32":
                    os.chmod(self.auth_file, 0o600)
            except Exception:
                # Clean up temp file on error
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                raise
        finally:
            if old_umask is not None:
                os.umask(old_umask)

    def load_tokens(self) -> Optional[Dict[str, Any]]:
        """Load tokens from storage.

        Returns:
            Token dictionary or None if not found
        """
        all_data = self._load_all()
        if all_data is None:
            return None
        return all_data.get(self.token_key)

    def delete_tokens(self) -> None:
        """Remove stored tokens."""
        existing = self._load_all()
        if existing and self.token_key in existing:
            del existing[self.token_key]
            self._save_all(existing)

    # API Key methods
    def save_api_key(self, api_key: str) -> None:
        """Save API key with auth method marker.

        Args:
            api_key: OpenAI API key (sk-...)
        """
        existing = self._load_all() or {}
        existing[API_KEY_STORAGE_KEY] = api_key
        existing[AUTH_METHOD_KEY] = AUTH_METHOD_API_KEY
        # Remove OAuth tokens if switching to API key
        if self.token_key in existing:
            del existing[self.token_key]
        self._save_all_secure(existing)

    def load_api_key(self) -> Optional[str]:
        """Load API key from storage.

        Returns:
            API key string or None if not found
        """
        all_data = self._load_all()
        if all_data is None:
            return None
        return all_data.get(API_KEY_STORAGE_KEY)

    def delete_api_key(self) -> None:
        """Remove stored API key."""
        existing = self._load_all()
        if existing and API_KEY_STORAGE_KEY in existing:
            del existing[API_KEY_STORAGE_KEY]
            if existing.get(AUTH_METHOD_KEY) == AUTH_METHOD_API_KEY:
                del existing[AUTH_METHOD_KEY]
            self._save_all(existing)

    def get_auth_method(self) -> Optional[str]:
        """Get current authentication method.

        Returns:
            'oauth' or 'api_key' or None if not set
        """
        all_data = self._load_all()
        if all_data is None:
            return None
        # Infer from stored data if not explicitly set
        if AUTH_METHOD_KEY in all_data:
            return all_data[AUTH_METHOD_KEY]
        if API_KEY_STORAGE_KEY in all_data:
            return AUTH_METHOD_API_KEY
        if self.token_key in all_data:
            return AUTH_METHOD_OAUTH
        return None

    def set_auth_method(self, method: str) -> None:
        """Set authentication method.

        Args:
            method: 'oauth' or 'api_key'
        """
        existing = self._load_all() or {}
        existing[AUTH_METHOD_KEY] = method
        self._save_all(existing)

    def clear_all(self) -> None:
        """Clear all stored credentials (tokens and API key)."""
        existing = self._load_all()
        if existing:
            if self.token_key in existing:
                del existing[self.token_key]
            if API_KEY_STORAGE_KEY in existing:
                del existing[API_KEY_STORAGE_KEY]
            if AUTH_METHOD_KEY in existing:
                del existing[AUTH_METHOD_KEY]
            self._save_all(existing)

    def _save_all_secure(self, data: Dict[str, Any]) -> None:
        """Save all auth data atomically with 0600 permissions.

        Args:
            data: Full auth dictionary to save
        """
        # Ensure directory exists with secure permissions
        self.auth_file.parent.mkdir(parents=True, exist_ok=True)
        if sys.platform != "win32":
            os.chmod(self.auth_file.parent, 0o700)

        dir_path = self.auth_file.parent
        old_umask = None
        if sys.platform != "win32":
            old_umask = os.umask(0o077)

        try:
            fd, temp_path = tempfile.mkstemp(dir=str(dir_path), suffix=".tmp")
            try:
                if sys.platform != "win32":
                    os.fchmod(fd, 0o600)
                with os.fdopen(fd, "w") as f:
                    json.dump(data, f, indent=2)
                os.rename(temp_path, self.auth_file)
                if sys.platform != "win32":
                    os.chmod(self.auth_file, 0o600)
            except Exception:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                raise
        finally:
            if old_umask is not None:
                os.umask(old_umask)

    def validate_permissions(self) -> bool:
        """Check if auth file has secure permissions (0600).

        Returns:
            True if permissions are secure, False otherwise
        """
        if not self.auth_file.exists():
            return True  # No file yet is fine

        mode = self.auth_file.stat().st_mode & 0o777
        return mode == 0o600

    def fix_permissions(self) -> None:
        """Fix file permissions to 0600."""
        if self.auth_file.exists():
            os.chmod(self.auth_file, 0o600)

    def _load_all(self) -> Optional[Dict[str, Any]]:
        """Load all auth data from file.

        Returns:
            Full auth dictionary or None if file doesn't exist
        """
        if not self.auth_file.exists():
            return None

        try:
            with open(self.auth_file, "r") as f:
                # Use file locking for thread safety
                _lock_file(f, exclusive=False)
                try:
                    return json.load(f)
                finally:
                    _unlock_file(f)
        except (json.JSONDecodeError, IOError):
            return None

    def _save_all(self, data: Dict[str, Any]) -> None:
        """Save all auth data to file.

        Args:
            data: Full auth dictionary to save
        """
        self.auth_file.parent.mkdir(parents=True, exist_ok=True)

        with open(self.auth_file, "w") as f:
            _lock_file(f, exclusive=True)
            try:
                json.dump(data, f, indent=2)
            finally:
                _unlock_file(f)

        if sys.platform != "win32":
            os.chmod(self.auth_file, 0o600)
