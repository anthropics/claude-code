#!/usr/bin/env python3
"""
Process @include directives in CLAUDE.md files.

Recursively processes @include <path> directives at the start of lines,
replacing them with the contents of the referenced files.

Path resolution:
- ~/...     → home directory expansion
- ./...     → relative to the including file's directory
- relative  → relative to the including file's directory
- absolute  → used as-is
"""

import json
import os
import re
import sys
from pathlib import Path

INCLUDE_PATTERN = re.compile(r'^@include\s+(.+?)\s*$')
MAX_DEPTH = 10  # Prevent runaway recursion


def resolve_path(include_path: str, base_dir: Path) -> Path:
    """Resolve an include path relative to the base directory."""
    include_path = include_path.strip()

    if not include_path:
        return None

    # Handle home directory expansion
    if include_path.startswith('~/'):
        return Path(os.path.expanduser(include_path))

    # Handle absolute paths
    if include_path.startswith('/'):
        return Path(include_path)

    # Handle relative paths (including ./)
    return base_dir / include_path


def process_file(file_path: Path, seen: set, depth: int = 0) -> str:
    """
    Process a file, expanding @include directives.

    Args:
        file_path: Path to the file to process
        seen: Set of already-seen absolute paths (for circular detection)
        depth: Current recursion depth

    Returns:
        Processed file content with includes expanded
    """
    if depth > MAX_DEPTH:
        print(f"Warning: Max include depth ({MAX_DEPTH}) exceeded at {file_path}", file=sys.stderr)
        return ""

    abs_path = file_path.resolve()

    # Check for circular includes
    if abs_path in seen:
        print(f"Error: Circular include detected: {file_path}", file=sys.stderr)
        return ""

    # Check if file exists
    if not file_path.exists():
        print(f"Warning: Include file not found: {file_path}", file=sys.stderr)
        return ""

    if not file_path.is_file():
        print(f"Warning: Include path is not a file: {file_path}", file=sys.stderr)
        return ""

    seen.add(abs_path)
    base_dir = file_path.parent

    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"Warning: Could not read {file_path}: {e}", file=sys.stderr)
        seen.discard(abs_path)
        return ""

    lines = content.splitlines(keepends=True)
    result = []

    for line in lines:
        match = INCLUDE_PATTERN.match(line)
        if match:
            include_path_str = match.group(1)
            include_path = resolve_path(include_path_str, base_dir)

            if include_path is None:
                # Empty @include, skip
                continue

            # Recursively process the included file
            included_content = process_file(include_path, seen, depth + 1)
            if included_content:
                # Ensure included content ends with newline for clean joining
                if not included_content.endswith('\n'):
                    included_content += '\n'
                result.append(included_content)
        else:
            result.append(line)

    seen.discard(abs_path)
    return ''.join(result)


def get_project_dir() -> str:
    """
    Get the project directory from available sources.

    Priority:
    1. CLAUDE_PROJECT_DIR environment variable (set by Claude Code)
    2. cwd from stdin JSON (hook input)
    3. Current working directory (fallback)
    """
    # Try environment variable first
    if 'CLAUDE_PROJECT_DIR' in os.environ:
        return os.environ['CLAUDE_PROJECT_DIR']

    # Try to read from stdin JSON (hooks receive input this way)
    try:
        if not sys.stdin.isatty():
            stdin_data = sys.stdin.read()
            if stdin_data.strip():
                hook_input = json.loads(stdin_data)
                if 'cwd' in hook_input:
                    return hook_input['cwd']
    except (json.JSONDecodeError, KeyError):
        pass

    # Fallback to current directory
    return os.getcwd()


def main():
    # Get the project directory
    project_dir = get_project_dir()
    claude_md_path = Path(project_dir) / 'CLAUDE.md'

    if not claude_md_path.exists():
        # No CLAUDE.md in project, output empty context
        output = {
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": ""
            }
        }
        print(json.dumps(output))
        return

    # Process the CLAUDE.md file
    seen = set()
    merged_content = process_file(claude_md_path, seen)

    # Output the result as JSON for the hook
    output = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": merged_content
        }
    }

    print(json.dumps(output))


if __name__ == '__main__':
    main()
