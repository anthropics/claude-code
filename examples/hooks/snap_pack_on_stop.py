#!/usr/bin/env python3
"""
Claude Code Hook: Auto-pack session on Stop
============================================

A `Stop` hook that packs the current Claude Code session JSONL into a
portable, lossless `.snap.jsonl` artifact when the session ends, then
drops it at a configured path so it can be handed off to another
device (iCloud Drive folder, Dropbox, Syncthing dir, etc.).

Read more about hooks: https://docs.anthropic.com/en/docs/claude-code/hooks
Read more about claude-snap: https://github.com/achiii800/claude-snap

WIRING
------
This hook is opt-in. To enable, add to `~/.claude/settings.json`
(adjust the absolute path to wherever you've placed this script):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 /absolute/path/to/snap_pack_on_stop.py"
          }
        ]
      }
    ]
  }
}
```

CONFIGURATION
-------------
Optional environment variables:

  CLAUDE_SNAP_DROP_PATH   Directory to write the .snap.jsonl into.
                          Default: ~/Documents/claude-snaps

  CLAUDE_SNAP_DISABLED    If set to "1", the hook noops. Useful for
                          temporarily turning auto-pack off without
                          editing settings.

INSTALL
-------
The hook calls the `claude-snap` CLI:

  pip install claude-snap

If `claude-snap` is not on PATH, the hook noops with a stderr
message — it never crashes Claude Code.
"""

from __future__ import annotations
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def _log(msg: str) -> None:
    """Hooks should write diagnostics to stderr; stdout is reserved
    for hook protocol replies on some events."""
    print(f"[snap_pack_on_stop] {msg}", file=sys.stderr)


def _read_event() -> dict:
    """Read the hook event JSON from stdin. Tolerate empty input."""
    try:
        raw = sys.stdin.read()
    except Exception as e:
        _log(f"failed to read stdin: {e}")
        return {}
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        _log("stdin was not valid JSON; continuing with empty event")
        return {}


def _resolve_session_path(event: dict) -> Path | None:
    """
    Determine which session JSONL to pack.

    Order of precedence:
      1. Explicit `transcript_path` field on the hook event (Claude Code
         passes this on most hook events).
      2. Most recent .jsonl under ~/.claude/projects/<encoded-cwd>/
         where encoded-cwd matches the current working directory.
      3. Most recent .jsonl under ~/.claude/projects/ regardless of cwd.
    """
    p = event.get("transcript_path")
    if p:
        path = Path(p).expanduser()
        if path.is_file():
            return path

    projects_root = Path.home() / ".claude" / "projects"
    if not projects_root.is_dir():
        return None

    cwd = Path.cwd()
    encoded = "-" + str(cwd).lstrip("/").replace("/", "-").replace(".", "-").replace("_", "-")
    cwd_dir = projects_root / encoded
    if cwd_dir.is_dir():
        candidates = sorted(cwd_dir.glob("*.jsonl"),
                            key=lambda f: f.stat().st_mtime,
                            reverse=True)
        if candidates:
            return candidates[0]

    candidates = sorted(projects_root.glob("*/*.jsonl"),
                        key=lambda f: f.stat().st_mtime,
                        reverse=True)
    return candidates[0] if candidates else None


def _resolve_drop_dir() -> Path:
    raw = os.environ.get("CLAUDE_SNAP_DROP_PATH")
    if raw:
        return Path(raw).expanduser()
    return Path.home() / "Documents" / "claude-snaps"


def _claude_snap_available() -> bool:
    return shutil.which("claude-snap") is not None


def main() -> int:
    if os.environ.get("CLAUDE_SNAP_DISABLED") == "1":
        return 0

    if not _claude_snap_available():
        _log("claude-snap not on PATH; skipping (install with `pip install claude-snap`)")
        return 0

    event = _read_event()
    session_path = _resolve_session_path(event)
    if session_path is None:
        _log("no session JSONL found; skipping")
        return 0

    drop_dir = _resolve_drop_dir()
    try:
        drop_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        _log(f"could not create drop dir {drop_dir}: {e}; skipping")
        return 0

    out_path = drop_dir / (session_path.stem + ".snap.jsonl")

    try:
        result = subprocess.run(
            ["claude-snap", "pack", str(session_path), "-o", str(out_path)],
            check=False,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        _log(f"claude-snap pack timed out after 60s; skipping")
        return 0
    except OSError as e:
        _log(f"failed to invoke claude-snap: {e}; skipping")
        return 0

    if result.returncode != 0:
        _log(f"claude-snap pack failed (rc={result.returncode}): "
             f"{result.stderr.strip()[:200]}")
        return 0

    _log(f"packed → {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
