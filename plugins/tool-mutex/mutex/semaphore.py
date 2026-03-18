#!/usr/bin/env python3
"""File-based counting semaphore for cross-process coordination.

Uses a shared directory to track active filesystem operations via slot files.
Each slot file represents one active operation. When the maximum number of
slots is reached, new operations must wait until a slot is freed.

This prevents parallel directory enumeration that can trigger the Windows
Wof.sys BSOD (see github.com/anthropics/claude-code/issues/32870).
"""

import os
import platform
import time
import json
import sys
from pathlib import Path

# Stale slot files older than this (seconds) are cleaned up automatically.
# This prevents deadlocks if a PostToolUse hook fails to release a slot.
STALE_THRESHOLD_SECONDS = 120

# Polling interval when waiting for a slot (seconds)
POLL_INTERVAL = 0.15

# Maximum wait time before giving up and allowing the operation anyway (seconds).
# Must be less than the hook timeout (30s) to avoid hook timeout errors.
MAX_WAIT_SECONDS = 20

# Delay (in seconds) applied in PreToolUse before allowing a filesystem tool to
# proceed. This provides a cooldown between consecutive operations, giving the
# OS (especially Windows Wof.sys) time to settle between directory enumerations.
# Configurable via CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS (min 15, max 1000).
DEFAULT_RELEASE_DELAY_MS = 75
MIN_RELEASE_DELAY_MS = 15
MAX_RELEASE_DELAY_MS = 1000


def _get_mutex_dir(session_id: str) -> Path:
    """Get the mutex directory for a given session.

    Uses a temp directory to avoid polluting the user's project.
    """
    base = Path(os.environ.get("TMPDIR", os.environ.get("TEMP", "/tmp")))
    mutex_dir = base / "claude-tool-mutex" / session_id
    mutex_dir.mkdir(parents=True, exist_ok=True)
    return mutex_dir


def _get_max_concurrent() -> int:
    """Get the maximum number of concurrent filesystem operations.

    On Windows, defaults to 1 (fully serialized) to prevent Wof.sys crashes.
    On other platforms, defaults to 4 (light throttling).

    Configurable via CLAUDE_TOOL_MUTEX_MAX_CONCURRENT environment variable.
    """
    env_val = os.environ.get("CLAUDE_TOOL_MUTEX_MAX_CONCURRENT")
    if env_val:
        try:
            val = int(env_val)
            if val > 0:
                return val
        except ValueError:
            pass

    if platform.system() == "Windows":
        return 1
    return 4


def _cleanup_stale_slots(mutex_dir: Path) -> int:
    """Remove stale slot files and return the number removed.

    A slot is considered stale if it's older than STALE_THRESHOLD_SECONDS.
    This handles cases where PostToolUse failed to clean up (crash, timeout, etc).
    """
    removed = 0
    now = time.time()
    try:
        for slot_file in mutex_dir.glob("slot_*"):
            try:
                mtime = slot_file.stat().st_mtime
                if now - mtime > STALE_THRESHOLD_SECONDS:
                    slot_file.unlink(missing_ok=True)
                    removed += 1
            except OSError:
                pass
    except OSError:
        pass
    return removed


def _count_active_slots(mutex_dir: Path) -> int:
    """Count the number of currently active slot files."""
    try:
        return len(list(mutex_dir.glob("slot_*")))
    except OSError:
        return 0


def _make_slot_id(tool_use_id: str, session_id: str) -> str:
    """Create a deterministic slot filename from the tool use identifier.

    The tool_use_id should be unique per tool call. If not available,
    falls back to session_id + timestamp + pid.
    """
    if tool_use_id:
        # Sanitize for filesystem safety
        safe_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in tool_use_id)
        return f"slot_{safe_id}"

    # Fallback: use pid + timestamp for uniqueness
    return f"slot_{session_id}_{os.getpid()}_{int(time.time() * 1000)}"


def acquire(session_id: str, tool_use_id: str = "", tool_name: str = "") -> bool:
    """Acquire a semaphore slot, waiting if necessary.

    Args:
        session_id: Current Claude Code session ID.
        tool_use_id: Unique identifier for this tool call.
        tool_name: Name of the tool being called (for logging).

    Returns:
        True if a slot was acquired, False if timed out (operation should
        still be allowed to prevent blocking the user).
    """
    mutex_dir = _get_mutex_dir(session_id)
    max_concurrent = _get_max_concurrent()
    slot_id = _make_slot_id(tool_use_id, session_id)
    slot_path = mutex_dir / slot_id

    # Create our slot file immediately with metadata
    slot_data = {
        "tool_name": tool_name,
        "pid": os.getpid(),
        "acquired_at": time.time(),
    }

    try:
        slot_path.write_text(json.dumps(slot_data))
    except OSError as e:
        # If we can't create the slot file, allow the operation
        _log(f"Warning: Cannot create slot file: {e}")
        return True

    # Clean up stale slots before counting
    _cleanup_stale_slots(mutex_dir)

    # Wait until our slot is within the allowed concurrency limit
    start_time = time.time()
    while True:
        active = _count_active_slots(mutex_dir)

        if active <= max_concurrent:
            # We have capacity (our slot is already counted in active).
            # Apply cooldown delay before letting the tool proceed, spacing
            # out consecutive filesystem operations at the PreToolUse gate.
            delay = _get_release_delay()
            time.sleep(delay)
            return True

        # Check timeout
        elapsed = time.time() - start_time
        if elapsed >= MAX_WAIT_SECONDS:
            _log(
                f"Warning: Mutex wait timeout after {elapsed:.1f}s "
                f"({active} active, max {max_concurrent}). "
                f"Allowing {tool_name} to proceed."
            )
            return True

        # Wait and retry
        time.sleep(POLL_INTERVAL)

        # Periodically clean stale slots while waiting
        if int(elapsed) % 5 == 0 and elapsed > 0:
            _cleanup_stale_slots(mutex_dir)


def _get_release_delay() -> float:
    """Get the release delay in seconds.

    Configurable via CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS env var.
    Clamped to [15, 1000] ms.
    """
    env_val = os.environ.get("CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS")
    if env_val:
        try:
            ms = int(env_val)
            ms = max(MIN_RELEASE_DELAY_MS, min(MAX_RELEASE_DELAY_MS, ms))
            return ms / 1000.0
        except ValueError:
            pass
    return DEFAULT_RELEASE_DELAY_MS / 1000.0


def release(session_id: str, tool_use_id: str = "") -> bool:
    """Release a semaphore slot.

    Args:
        session_id: Current Claude Code session ID.
        tool_use_id: Unique identifier for this tool call.

    Returns:
        True if the slot was released, False if not found.
    """
    mutex_dir = _get_mutex_dir(session_id)
    slot_id = _make_slot_id(tool_use_id, session_id)
    slot_path = mutex_dir / slot_id

    try:
        slot_path.unlink(missing_ok=True)
        return True
    except OSError as e:
        _log(f"Warning: Cannot release slot: {e}")
        return False


def cleanup_session(session_id: str) -> None:
    """Remove all slot files for a session.

    Called during session cleanup to prevent leftover files.
    """
    mutex_dir = _get_mutex_dir(session_id)
    try:
        for slot_file in mutex_dir.glob("slot_*"):
            try:
                slot_file.unlink(missing_ok=True)
            except OSError:
                pass
        # Try to remove the directory itself
        mutex_dir.rmdir()
    except OSError:
        pass


def _log(message: str) -> None:
    """Log a message to stderr (visible to user but not to Claude)."""
    print(f"[tool-mutex] {message}", file=sys.stderr)
