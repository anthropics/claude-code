"""Session state management for tracking tool use and verification results."""

import json
import os
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class ToolUseRecord:
    """Record of a tool use during the session."""
    tool_name: str
    timestamp: float
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class VerificationResult:
    """Result of a claim verification."""
    claim_type: str
    claim_text: str
    passed: bool
    message: str
    timestamp: float
    details: dict[str, Any] = field(default_factory=dict)


class SessionState:
    """Manages session-scoped state for verification tracking."""

    STATE_DIR = Path.home() / ".claude"
    STATE_PREFIX = "verify_claims_state_"

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.state_file = self.STATE_DIR / f"{self.STATE_PREFIX}{session_id}.json"
        self._state = self._load_or_create()

    def _load_or_create(self) -> dict[str, Any]:
        """Load existing state or create new."""
        if self.state_file.exists():
            try:
                with open(self.state_file) as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError):
                pass

        return {
            "session_id": self.session_id,
            "created_at": time.time(),
            "files_written": [],
            "commands_run": [],
            "verification_results": [],
            "verification_count": 0,
            "stop_hook_active": False
        }

    def _save(self) -> None:
        """Save state to file."""
        self.STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(self.state_file, 'w') as f:
            json.dump(self._state, f, indent=2)

    @property
    def stop_hook_active(self) -> bool:
        """Check if stop hook is currently active (prevents infinite loops)."""
        return self._state.get("stop_hook_active", False)

    @stop_hook_active.setter
    def stop_hook_active(self, value: bool) -> None:
        self._state["stop_hook_active"] = value
        self._save()

    @property
    def verification_count(self) -> int:
        """Number of verification attempts this session."""
        return self._state.get("verification_count", 0)

    def increment_verification_count(self) -> int:
        """Increment and return the new verification count."""
        self._state["verification_count"] = self.verification_count + 1
        self._save()
        return self._state["verification_count"]

    def add_file_written(self, file_path: str, tool_name: str) -> None:
        """Track a file that was written."""
        self._state["files_written"].append({
            "path": file_path,
            "tool": tool_name,
            "timestamp": time.time()
        })
        self._save()

    def add_command_run(self, command: str, exit_code: int, is_test: bool = False,
                        is_lint: bool = False, is_build: bool = False) -> None:
        """Track a command that was run."""
        self._state["commands_run"].append({
            "command": command,
            "exit_code": exit_code,
            "is_test": is_test,
            "is_lint": is_lint,
            "is_build": is_build,
            "timestamp": time.time()
        })
        self._save()

    def add_verification_result(self, result: VerificationResult) -> None:
        """Add a verification result."""
        self._state["verification_results"].append(asdict(result))
        self._save()

    def get_files_written(self) -> list[dict[str, Any]]:
        """Get all files written this session."""
        return self._state.get("files_written", [])

    def get_commands_run(self) -> list[dict[str, Any]]:
        """Get all commands run this session."""
        return self._state.get("commands_run", [])

    def was_file_written(self, file_path: str) -> bool:
        """Check if a file was written during this session."""
        abs_path = os.path.abspath(file_path)
        for record in self._state.get("files_written", []):
            if os.path.abspath(record["path"]) == abs_path:
                return True
        return False

    def last_test_passed(self) -> bool | None:
        """Check if the last test command passed."""
        for cmd in reversed(self._state.get("commands_run", [])):
            if cmd.get("is_test"):
                return cmd.get("exit_code") == 0
        return None

    def last_lint_passed(self) -> bool | None:
        """Check if the last lint command passed."""
        for cmd in reversed(self._state.get("commands_run", [])):
            if cmd.get("is_lint"):
                return cmd.get("exit_code") == 0
        return None

    def last_build_passed(self) -> bool | None:
        """Check if the last build command passed."""
        for cmd in reversed(self._state.get("commands_run", [])):
            if cmd.get("is_build"):
                return cmd.get("exit_code") == 0
        return None

    @classmethod
    def cleanup_old_states(cls, max_age_days: int = 30) -> int:
        """Remove state files older than max_age_days. Returns count removed."""
        removed = 0
        max_age_seconds = max_age_days * 24 * 60 * 60
        now = time.time()

        if not cls.STATE_DIR.exists():
            return 0

        for state_file in cls.STATE_DIR.glob(f"{cls.STATE_PREFIX}*.json"):
            try:
                mtime = state_file.stat().st_mtime
                if now - mtime > max_age_seconds:
                    state_file.unlink()
                    removed += 1
            except OSError:
                pass

        return removed
