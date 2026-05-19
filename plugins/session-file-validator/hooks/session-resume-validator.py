#!/usr/bin/env python3
"""Session Resume File Validator for Claude Code.

Validates file content on session resume to detect stale cached data.
Addresses GitHub issue #15285.

Requires Python 3.7+ for dict ordering guarantees.
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Optional, Tuple


def is_image_content(content: list) -> bool:
    """Check if content contains image data."""
    if not isinstance(content, list):
        return False
    return any(
        isinstance(item, dict) and item.get("type") == "image"
        for item in content
    )


def extract_file_path_from_tool_use(tool_use: dict) -> Optional[str]:
    """Extract file path from a Read tool use."""
    if tool_use.get("type") != "tool_use":
        return None
    if tool_use.get("name") not in ("Read", "read"):
        return None
    tool_input = tool_use.get("input", {})
    return tool_input.get("file_path") or tool_input.get("path")


def validate_path_security(file_path: str) -> bool:
    """Validate file path for security (traversal, null bytes, etc.)."""
    if not file_path or "\x00" in file_path:
        return False

    # Reject obvious path traversal attempts in original path
    if file_path.startswith("..") or "/../" in file_path or file_path.endswith("/.."):
        return False

    try:
        resolved = Path(file_path).resolve()
        return resolved.is_absolute() and ".." not in str(resolved)
    except (OSError, ValueError, RuntimeError):
        return False


def is_symlink_safe(file_path: str) -> bool:
    """Check if a file path is safe regarding symlinks."""
    try:
        path = Path(file_path)
        if not path.exists():
            return True
        if path.is_symlink():
            resolved = path.resolve()
            return resolved.exists() and resolved.is_file()
        return True
    except (OSError, ValueError, RuntimeError):
        return False


def parse_transcript(transcript_path: str) -> list:
    """Parse JSONL transcript file."""
    entries = []
    try:
        with open(transcript_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    except (OSError, IOError):
        pass
    return entries


def find_image_files_in_transcript(entries: list) -> List[Tuple[str, str]]:
    """Find all image file reads in the transcript."""
    image_files = []
    tool_use_map = {}

    for entry in entries:
        message = entry.get("message", {})
        content = message.get("content", [])

        if not isinstance(content, list):
            continue

        for block in content:
            if not isinstance(block, dict):
                continue

            if block.get("type") == "tool_use":
                file_path = extract_file_path_from_tool_use(block)
                if file_path:
                    tool_use_id = block.get("id")
                    if tool_use_id:
                        tool_use_map[tool_use_id] = file_path

            if block.get("type") == "tool_result":
                tool_use_id = block.get("tool_use_id")
                result_content = block.get("content", [])

                if is_image_content(result_content):
                    file_path = tool_use_map.get(tool_use_id)
                    if file_path and validate_path_security(file_path) and is_symlink_safe(file_path):
                        image_files.append((file_path, tool_use_id))

    return image_files


def build_context_message(existing_files: list, missing_files: list) -> str:
    """Build the context message for Claude."""
    if not missing_files and not existing_files:
        return ""

    parts = [
        "SESSION RESUME FILE VALIDATION ALERT",
        "-" * 40,
        "",
        "This session was resumed from a previous conversation. "
        "The following files were read as images in the original session:",
        ""
    ]

    if missing_files:
        unique_missing = list(dict.fromkeys(missing_files))
        parts.append("FILES NO LONGER AVAILABLE:")
        for fp in unique_missing:
            parts.append(f"  - {fp} (DELETED/MOVED)")
        parts.extend([
            "",
            "The cached image data from the original session will be used, "
            "but be aware these files no longer exist on disk.",
            ""
        ])

    if existing_files:
        unique_existing = list(dict.fromkeys(existing_files))
        parts.append("FILES THAT MAY HAVE CHANGED:")
        for fp in unique_existing:
            parts.append(f"  - {fp}")
        parts.extend([
            "",
            "IMPORTANT: If the user asks you to read or describe any of these "
            "files, you MUST use the Read tool to fetch the current content. "
            "Do NOT rely on cached data from the previous session as file "
            "contents may have changed.",
            "",
            "If the user asks about a NEW image file that was not in the "
            "original session, always read it fresh - do not assume you "
            "already know its contents."
        ])

    return "\n".join(parts)


def main():
    """Main entry point for the session resume validator hook."""
    try:
        input_data = json.load(sys.stdin)

        if input_data.get("source") != "resume":
            print(json.dumps({}))
            sys.exit(0)

        transcript_path = input_data.get("transcript_path", "")
        if not transcript_path or not os.path.exists(transcript_path):
            print(json.dumps({}))
            sys.exit(0)

        entries = parse_transcript(transcript_path)
        if not entries:
            print(json.dumps({}))
            sys.exit(0)

        image_files = find_image_files_in_transcript(entries)
        if not image_files:
            print(json.dumps({}))
            sys.exit(0)

        existing_files = []
        missing_files = []

        for file_path, _ in image_files:
            if Path(file_path).exists():
                existing_files.append(file_path)
            else:
                missing_files.append(file_path)

        context = build_context_message(existing_files, missing_files)

        if context:
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "SessionStart",
                    "additionalContext": context
                }
            }
            print(json.dumps(output))
        else:
            print(json.dumps({}))

        sys.exit(0)

    except (json.JSONDecodeError, Exception):
        print(json.dumps({}))
        sys.exit(0)


if __name__ == "__main__":
    main()
