"""
Per-session state-file plumbing for the security-guidance plugin.

Holds the JSON state file location, fcntl-locked read-modify-write helper,
and old-file GC. Side-effect-free at import time (no env-var reads beyond
``CLAUDE_CODE_REMOTE_SESSION_ID`` inside the helpers).

The ``atomic_check_*`` helpers that build on ``with_locked_state`` deliberately
remain in ``security_reminder_hook.py`` so that tests which monkeypatch
``hook.with_locked_state`` and then call a handler still see the patched
binding via the handler → ``atomic_check_*`` → bare-name lookup chain.
"""
try:
    import fcntl
except ImportError:
    fcntl = None
import json
import os
import re
from datetime import datetime

from _base import debug_log


def _state_key(session_id):
    # In CCR each user turn is a new CC process with a fresh session_id; the
    # remote session ID is stable across those restarts. Prefer it so the
    # pending-warnings sweep and any unprocessed touched_paths survive.
    key = os.environ.get("CLAUDE_CODE_REMOTE_SESSION_ID") or session_id
    # The key becomes a filename component under the state dir. CC session ids
    # are UUIDs (sanitization is a no-op for them), but nothing in the hook
    # protocol guarantees that, so strip path separators and anything else
    # that could escape the state dir, and bound the length.
    return re.sub(r"[^A-Za-z0-9._-]", "_", str(key))[:128]


def get_state_file(session_id):
    """Get session-specific state file path."""
    state_dir = os.environ.get("SECURITY_WARNINGS_STATE_DIR", os.path.expanduser("~/.claude/security"))
    return os.path.join(state_dir, f"security_warnings_state_{_state_key(session_id)}.json")


def get_lock_file(session_id):
    """Get session-specific lock file path."""
    state_dir = os.environ.get("SECURITY_WARNINGS_STATE_DIR", os.path.expanduser("~/.claude/security"))
    return os.path.join(state_dir, f"security_warnings_state_{_state_key(session_id)}.lock")


def cleanup_old_state_files():
    """Remove state files and lock files older than 30 days."""
    try:
        state_dir = os.environ.get("SECURITY_WARNINGS_STATE_DIR", os.path.expanduser("~/.claude/security"))
        if not os.path.exists(state_dir):
            return

        current_time = datetime.now().timestamp()
        thirty_days_ago = current_time - (30 * 24 * 60 * 60)

        for filename in os.listdir(state_dir):
            if filename.startswith("security_warnings_state_") and (
                filename.endswith(".json") or filename.endswith(".lock")
            ):
                file_path = os.path.join(state_dir, filename)
                try:
                    file_mtime = os.path.getmtime(file_path)
                    if file_mtime < thirty_days_ago:
                        os.remove(file_path)
                except (OSError, IOError):
                    pass

        # Sweep legacy lock files left at ~/.claude/ root by versions
        # <1.1.66, where get_lock_file() didn't honor state_dir. Same
        # 30-day mtime gate as above so we don't race an older
        # concurrent peer that may still hold an active lock.
        legacy_dir = os.path.expanduser("~/.claude")
        for filename in os.listdir(legacy_dir):
            if filename.startswith("security_warnings_state_") and filename.endswith(".lock"):
                file_path = os.path.join(legacy_dir, filename)
                try:
                    if os.path.getmtime(file_path) < thirty_days_ago:
                        os.remove(file_path)
                except (OSError, IOError):
                    pass
    except Exception:
        pass


def load_state(session_id):
    """Load the full state dict from file."""
    state_file = get_state_file(session_id)
    try:
        with open(state_file, "r") as f:
            data = json.load(f)
            if isinstance(data, list):
                return {"shown_warnings": data}
            if isinstance(data, dict):
                data.setdefault("shown_warnings", [])
                return data
    except (json.JSONDecodeError, IOError, KeyError, TypeError):
        pass
    return {"shown_warnings": []}


def save_state(session_id, state):
    """Save the full state dict to file."""
    state_file = get_state_file(session_id)
    try:
        state_dir = os.path.dirname(state_file)
        if state_dir:
            os.makedirs(state_dir, exist_ok=True)

        with open(state_file, "w") as f:
            json.dump(state, f)
    except (IOError, OSError) as e:
        debug_log(f"Failed to save state file {state_file}: {e}")


def with_locked_state(session_id, callback):
    """
    Execute callback with exclusive access to the state file.
    The callback receives the state dict and can modify it in place.
    State is saved after the callback returns.
    Returns the callback's return value.
    """
    lock_file = get_lock_file(session_id)
    state_dir = os.path.dirname(lock_file)

    try:
        os.makedirs(state_dir, exist_ok=True)
    except OSError:
        pass

    if fcntl is None:
        # No file locking available (Windows) — run without locking
        state = load_state(session_id)
        result = callback(state)
        save_state(session_id, state)
        return result

    lock_fd = None
    try:
        lock_fd = os.open(lock_file, os.O_RDWR | os.O_CREAT)
        fcntl.flock(lock_fd, fcntl.LOCK_EX)

        state = load_state(session_id)
        result = callback(state)
        save_state(session_id, state)
        return result

    except (OSError, IOError) as e:
        debug_log(f"Lock/state operation failed: {e}")
        return None

    finally:
        if lock_fd is not None:
            try:
                fcntl.flock(lock_fd, fcntl.LOCK_UN)
                os.close(lock_fd)
            except (OSError, IOError):
                pass

