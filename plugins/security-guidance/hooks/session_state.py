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

def is_approved