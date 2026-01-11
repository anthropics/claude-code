"""User configuration management for Codex plugin.

Handles persistent storage of user preferences like default model,
approval mode, and session history.
"""

import json
import os
from typing import Dict, Any, Optional, List
from datetime import datetime

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    USER_CONFIG_PATH,
    DEFAULT_MODEL,
    DEFAULT_APPROVAL_MODE,
    AVAILABLE_MODELS,
    APPROVAL_MODES
)


class UserConfigError(Exception):
    """User config error."""
    pass


class UserConfig:
    """Manage user configuration and session history."""

    def __init__(self, config_path: str = USER_CONFIG_PATH):
        """Initialize user config manager.

        Args:
            config_path: Path to config file
        """
        self.config_path = config_path
        self._config: Optional[Dict[str, Any]] = None

    def _load(self) -> Dict[str, Any]:
        """Load config from file."""
        if self._config is not None:
            return self._config

        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    self._config = json.load(f)
            except (json.JSONDecodeError, IOError):
                self._config = self._default_config()
        else:
            self._config = self._default_config()

        return self._config

    def _save(self) -> None:
        """Save config to file."""
        if self._config is None:
            return

        # Ensure directory exists
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)

        with open(self.config_path, "w") as f:
            json.dump(self._config, f, indent=2)

    def _default_config(self) -> Dict[str, Any]:
        """Get default config."""
        return {
            "model": DEFAULT_MODEL,
            "approval_mode": DEFAULT_APPROVAL_MODE,
            "sessions": []
        }

    # Model management
    def get_model(self) -> str:
        """Get current default model."""
        config = self._load()
        return config.get("model", DEFAULT_MODEL)

    def set_model(self, model: str) -> None:
        """Set default model.

        Args:
            model: Model name

        Raises:
            UserConfigError: If model is not valid
        """
        if model not in AVAILABLE_MODELS:
            raise UserConfigError(
                f"Invalid model: {model}. "
                f"Available: {', '.join(AVAILABLE_MODELS)}"
            )

        config = self._load()
        config["model"] = model
        self._save()

    def get_available_models(self) -> List[str]:
        """Get list of available models."""
        return AVAILABLE_MODELS.copy()

    # Approval mode management
    def get_approval_mode(self) -> str:
        """Get current approval mode."""
        config = self._load()
        return config.get("approval_mode", DEFAULT_APPROVAL_MODE)

    def set_approval_mode(self, mode: str) -> None:
        """Set approval mode.

        Args:
            mode: Approval mode

        Raises:
            UserConfigError: If mode is not valid
        """
        if mode not in APPROVAL_MODES:
            raise UserConfigError(
                f"Invalid mode: {mode}. "
                f"Available: {', '.join(APPROVAL_MODES)}"
            )

        config = self._load()
        config["approval_mode"] = mode
        self._save()

    def get_approval_modes(self) -> List[str]:
        """Get list of available approval modes."""
        return APPROVAL_MODES.copy()

    # Session management
    def add_session(self, session_id: str, prompt: str) -> None:
        """Add a session to history.

        Args:
            session_id: Unique session identifier
            prompt: Initial prompt
        """
        config = self._load()
        sessions = config.get("sessions", [])

        # Add new session
        sessions.insert(0, {
            "id": session_id,
            "prompt": prompt[:100],  # Truncate for storage
            "timestamp": datetime.now().isoformat(),
            "messages": []
        })

        # Keep only last 20 sessions
        config["sessions"] = sessions[:20]
        self._save()

    def get_sessions(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent sessions.

        Args:
            limit: Maximum number of sessions to return

        Returns:
            List of session summaries
        """
        config = self._load()
        sessions = config.get("sessions", [])
        return sessions[:limit]

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific session.

        Args:
            session_id: Session identifier

        Returns:
            Session data or None
        """
        config = self._load()
        sessions = config.get("sessions", [])
        for session in sessions:
            if session.get("id") == session_id:
                return session
        return None

    def update_session(self, session_id: str, messages: List[Dict]) -> None:
        """Update session messages.

        Args:
            session_id: Session identifier
            messages: Updated messages list (full content preserved)
        """
        config = self._load()
        sessions = config.get("sessions", [])
        for session in sessions:
            if session.get("id") == session_id:
                # Keep last 20 messages to maintain context
                session["messages"] = messages[-20:]
                # Update prompt summary for display
                if messages:
                    last_user_msg = next(
                        (m["content"] for m in reversed(messages) if m["role"] == "user"),
                        session.get("prompt", "")
                    )
                    session["prompt"] = last_user_msg[:100]
                break
        self._save()

    def clear_sessions(self) -> None:
        """Clear all session history."""
        config = self._load()
        config["sessions"] = []
        self._save()

    # Full config access
    def get_config(self) -> Dict[str, Any]:
        """Get full config.

        Returns:
            Config dictionary (without session details)
        """
        config = self._load()
        return {
            "model": config.get("model", DEFAULT_MODEL),
            "approval_mode": config.get("approval_mode", DEFAULT_APPROVAL_MODE),
            "session_count": len(config.get("sessions", []))
        }

    def set_config(self, key: str, value: Any) -> None:
        """Set a config value.

        Args:
            key: Config key
            value: Config value

        Raises:
            UserConfigError: If key/value is invalid
        """
        if key == "model":
            self.set_model(value)
        elif key == "approval_mode":
            self.set_approval_mode(value)
        else:
            raise UserConfigError(f"Unknown config key: {key}")
