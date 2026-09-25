#!/usr/bin/env python3
"""
CLI-Desktop Session Sync for Claude Code.

Bridges the gap between CLI session transcripts (~/.claude/projects/**/*.jsonl)
and the Claude desktop app's session list by synthesising local_<uuid>.json
metadata files in the desktop app's session directory.

Usage:
    python3 sync_sessions.py              # Full sync of all CLI sessions
    python3 sync_sessions.py --dry-run    # Preview without writing
    python3 sync_sessions.py --sync-current  # Only sync the current session
"""

import argparse
import hashlib
import json
import os
import platform
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


# ── Helpers ──────────────────────────────────────────────────────────

def get_cli_sessions_dir() -> Path:
    """Return the CLI session transcript directory (~/.claude/projects/)."""
    return Path.home() / ".claude" / "projects"


def get_desktop_sessions_dir() -> Path | None:
    """Return the desktop app's session metadata directory, or None if not found."""
    system = platform.system()
    if system == "Darwin":
        base = Path.home() / "Library" / "Application Support" / "Claude"
    elif system == "Windows":
        appdata = os.environ.get("APPDATA")
        if not appdata:
            return None
        base = Path(appdata) / "Claude"
    elif system == "Linux":
        base = Path.home() / ".config" / "Claude"
    else:
        return None

    candidate = base / "claude-code-sessions"
    return candidate if candidate.exists() else None


def cli_session_id(rel_path: str) -> str:
    """Derive a deterministic, stable session identifier from the transcript's
    relative path under ~/.claude/projects/."""
    # Use a hash of the path so the id is short, stable, and unique.
    return hashlib.sha256(rel_path.encode()).hexdigest()[:16]


def desktop_metadata_path(desktop_dir: Path, sid: str) -> Path:
    """Return the path for a desktop metadata file."""
    return desktop_dir / f"local_{sid}.json"


def parse_transcript_summary(path: Path) -> dict:
    """Read the first few lines of a .jsonl transcript to extract metadata."""
    result: dict = {
        "title": path.stem,
        "model": "claude",
        "created_at": datetime.fromtimestamp(
            path.stat().st_mtime, tz=timezone.utc
        ).isoformat(),
        "last_activity": datetime.fromtimestamp(
            path.stat().st_mtime, tz=timezone.utc
        ).isoformat(),
        "message_count": 0,
    }
    try:
        with open(path, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                if i > 20:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                role = obj.get("role", "")
                content = obj.get("content", "")
                if role == "user" and isinstance(content, str) and content.strip():
                    # Use first meaningful user message as the title
                    if result["title"] == path.stem:
                        result["title"] = content[:80]
                    result["message_count"] += 1
                elif role == "assistant":
                    result["message_count"] += 1
                # Extract model info from system/first assistant messages
                model = obj.get("model", "")
                if model and result["model"] == "claude":
                    result["model"] = model
                # Extract timestamps
                ts = obj.get("ts") or obj.get("timestamp") or obj.get("created_at")
                if ts:
                    try:
                        parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        if i == 0:
                            result["created_at"] = parsed.isoformat()
                        result["last_activity"] = parsed.isoformat()
                    except (ValueError, TypeError):
                        pass
    except (OSError, IOError) as exc:
        print(f"Warning: could not read {path}: {exc}", file=sys.stderr)

    return result


def find_mounted_sessions(desktop_dir: Path) -> set[str]:
    """Return the set of cliSessionId values already registered in the desktop app."""
    mounted: set[str] = set()
    if not desktop_dir or not desktop_dir.exists():
        return mounted
    for fpath in desktop_dir.glob("local_*.json"):
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
            sid = data.get("cliSessionId")
            if sid:
                mounted.add(sid)
        except (json.JSONDecodeError, OSError):
            continue
    return mounted


# ── Sync logic ───────────────────────────────────────────────────────

def sync_sessions(dry_run: bool = False, sync_current_only: bool = False) -> dict:
    """Synchronise CLI transcripts to the desktop app. Returns a summary dict."""
    cli_dir = get_cli_sessions_dir()
    desktop_dir = get_desktop_sessions_dir()

    result: dict = {
        "cli_dir": str(cli_dir),
        "desktop_dir": str(desktop_dir) if desktop_dir else None,
        "found": 0,
        "synced": 0,
        "skipped": 0,
        "errors": [],
    }

    if not cli_dir.exists():
        result["errors"].append(f"CLI sessions directory not found: {cli_dir}")
        return result

    if not desktop_dir:
        result["errors"].append(
            "Desktop app session directory not found. Is the desktop app installed?"
        )
        return result

    # Collect existing mappings
    mounted = find_mounted_sessions(desktop_dir)

    # Walk all .jsonl transcript files
    transcripts = list(cli_dir.rglob("*.jsonl"))
    result["found"] = len(transcripts)

    for tpath in transcripts:
        # Relative path used as the stable CLI session identifier
        rel = tpath.relative_to(cli_dir).as_posix()
        sid = cli_session_id(rel)

        if sid in mounted:
            result["skipped"] += 1
            continue

        if sync_current_only:
            # Skip sessions that aren't modified in the last minute
            age = datetime.now().timestamp() - tpath.stat().st_mtime
            if age > 120:
                result["skipped"] += 1
                continue

        # Extract metadata from the transcript
        meta = parse_transcript_summary(tpath)

        # Build desktop metadata payload
        payload: dict = {
            "title": meta["title"],
            "model": meta["model"],
            "date": meta["last_activity"],
            "createdAt": meta["created_at"],
            "messageCount": meta["message_count"],
            "cliSessionId": rel,
            "sessionId": sid,
            "platform": "cli",
            "projectDir": str(tpath.parent),
        }

        dest = desktop_metadata_path(desktop_dir, sid)

        if dry_run:
            print(f"[DRY-RUN] Would write: {dest}")
            print(f"          Payload: {json.dumps(payload, indent=2)}")
            result["synced"] += 1
            continue

        try:
            with open(dest, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            result["synced"] += 1
        except OSError as exc:
            result["errors"].append(f"Failed to write {dest}: {exc}")

    return result


def format_summary(r: dict, dry_run: bool) -> str:
    """Return a human-readable summary string."""
    lines = [
        "📋 **CLI → Desktop Session Sync**",
        f"   CLI transcripts directory: `{r['cli_dir']}`",
    ]
    if r["desktop_dir"]:
        lines.append(f"   Desktop sessions directory: `{r['desktop_dir']}`")
    lines.append("")
    lines.append(f"   • Found: **{r['found']}** CLI session(s)")
    if dry_run:
        lines.append(f"   • Would sync: **{r['synced']}** (dry-run)")
    else:
        lines.append(f"   • Synced: **{r['synced']}**")
        lines.append(f"   • Already synced / skipped: **{r['skipped']}**")
    if r["errors"]:
        for err in r["errors"]:
            lines.append(f"   ⚠️  {err}")
    lines.append("")
    if not dry_run and r["synced"] > 0:
        lines.append("   ✅ Open the Claude desktop app — your CLI sessions should now appear in the conversation list.")
    elif r["synced"] == 0 and not r["errors"]:
        lines.append("   ✅ All CLI sessions are already synced to the desktop app.")
    return "\n".join(lines)


# ── Entry point ──────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Sync Claude Code CLI session transcripts to the desktop app."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be synced without writing any files.",
    )
    parser.add_argument(
        "--sync-current",
        action="store_true",
        help="Only sync the most recently active session (for use as a PostToolUse hook).",
    )
    args = parser.parse_args()

    r = sync_sessions(dry_run=args.dry_run, sync_current_only=args.sync_current)
    print(format_summary(r, dry_run=args.dry_run))

    if r["errors"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
