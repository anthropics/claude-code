"""Shared utilities for hookify hook executors."""

import json
import re
import sys


# Regex to find backslashes NOT followed by a valid JSON escape character.
# Valid JSON escapes: " \ / b f n r t u
_INVALID_ESCAPE_RE = re.compile(r'\\(?!["\\/bfnrtu])')


def safe_json_load(stream=None):
    """Read JSON from a stream, tolerating unescaped backslashes in Windows paths.

    On Windows, Claude Code may pass file paths with unescaped backslashes
    (e.g. C:\\Users\\...) which are invalid JSON. This function attempts a
    normal parse first, and falls back to escaping lone backslashes on failure.

    Args:
        stream: File-like object to read from. Defaults to sys.stdin.

    Returns:
        Parsed JSON data as a dict.

    Raises:
        json.JSONDecodeError: If JSON is still invalid after repair.
    """
    if stream is None:
        stream = sys.stdin

    raw = stream.read()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Escape lone backslashes that aren't part of valid JSON escape sequences
        repaired = _INVALID_ESCAPE_RE.sub(r'\\\\', raw)
        return json.loads(repaired)
