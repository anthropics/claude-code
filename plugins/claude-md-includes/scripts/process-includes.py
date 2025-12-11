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

Security:
- Paths are validated to prevent directory traversal attacks
- Only files within allowed directories can be included
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Optional, Set

# Use greedy match (.+) to support paths with spaces
INCLUDE_PATTERN = re.compile(r'^@include\s+(.+)\s*$')
MAX_DEPTH = 10  # Prevent runaway recursion


def resolve_path(include_path: str, base_dir: Path) -> Optional[Path]:
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


def is_path_safe(resolved_path: Path, base_dir: Path) -> bool:
    """
    Validate that the resolved path doesn't escape allowed boundaries.

    Allowed locations:
    - Within the project directory (base_dir or its subdirectories)
    - Within user's home directory ~/.claude/ folder
    - Absolute paths that exist and are readable

    This prevents directory traversal attacks like @include ../../../etc/passwd
    """
    try:
        resolved = resolved_path.resolve()
        base_resolved = base_dir.resolve()
        home_claude = Path.home() / '.claude'

        # Allow paths within project directory
        try:
            resolved.relative_to(base_resolved)
            return True
        except ValueError:
            pass

        # Allow paths within ~/.claude/
        try:
            resolved.relative_to(home_claude)
            return True
        except ValueError:
            pass

        # For absolute paths outside these directories, check they're not
        # trying to access sensitive system files
        if resolved.exists():
            # Block common sensitive paths
            sensitive_prefixes = ['/etc/', '/var/', '/usr/', '/sys/', '/proc/']
            resolved_str = str(resolved)
            for prefix in sensitive_prefixes:
                if resolved_str.startswith(prefix):
                    return False
            return True

        return False
    except (OSError, ValueError):
        return False


def is_in_code_block(lines: list, current_index: int) -> bool:
    """
    Check if the current line is inside a markdown code block.

    Tracks opening/closing triple backticks to determine if we're
    inside a fenced code block where @include should be ignored.
    """
    in_block = False
    for i in range(current_index):
        line = lines[i].rstrip()
        # Check for code fence (``` with optional language specifier)
        if line.startswith('```'):
            in_block = not in_block
    return in_block


def process_file(file_path: Path, include_chain: Set[Path], depth: int = 0, project_dir: Optional[Path] = None) -> str:
    """
    Process a file, expanding @include directives.

    Args:
        file_path: Path to the file to process
        include_chain: Set of files currently being processed (for circular detection)
        depth: Current recursion depth
        project_dir: Root project directory for path validation

    Returns:
        Processed file content with includes expanded
    """
    if depth > MAX_DEPTH:
        print(f"Warning: Max include depth ({MAX_DEPTH}) exceeded at {file_path}", file=sys.stderr)
        return ""

    abs_path = file_path.resolve()

    # Check for circular includes
    if abs_path in include_chain:
        print(f"Warning: Circular include detected: {file_path}", file=sys.stderr)
        return ""

    # Check if file exists
    if not file_path.exists():
        print(f"Warning: Include file not found: {file_path}", file=sys.stderr)
        return ""

    if not file_path.is_file():
        print(f"Warning: Include path is not a file: {file_path}", file=sys.stderr)
        return ""

    include_chain.add(abs_path)
    base_dir = file_path.parent

    # Use project_dir for path validation, defaulting to base_dir
    validation_base = project_dir if project_dir else base_dir

    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"Warning: Could not read {file_path}: {e}", file=sys.stderr)
        include_chain.discard(abs_path)
        return ""

    lines = content.splitlines(keepends=True)
    result = []

    for i, line in enumerate(lines):
        # Skip @include directives inside code blocks
        if is_in_code_block(lines, i):
            result.append(line)
            continue

        match = INCLUDE_PATTERN.match(line)
        if match:
            include_path_str = match.group(1)
            include_path = resolve_path(include_path_str, base_dir)

            if include_path is None:
                # Empty @include, skip
                continue

            # Validate path for security
            if not is_path_safe(include_path, validation_base):
                print(f"Warning: Path not allowed (security): {include_path}", file=sys.stderr)
                continue

            # Recursively process the included file
            included_content = process_file(include_path, include_chain, depth + 1, validation_base)
            if included_content:
                # Ensure included content ends with newline for clean joining
                if not included_content.endswith('\n'):
                    included_content += '\n'
                result.append(included_content)
        else:
            result.append(line)

    include_chain.discard(abs_path)
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
    project_dir_str = get_project_dir()
    project_dir = Path(project_dir_str)
    claude_md_path = project_dir / 'CLAUDE.md'

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
    include_chain: Set[Path] = set()
    merged_content = process_file(claude_md_path, include_chain, project_dir=project_dir)

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
