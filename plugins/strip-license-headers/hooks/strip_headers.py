#!/usr/bin/env python3
"""PreToolUse hook to strip license headers from Read operations.

This hook intercepts Read tool calls and modifies the offset parameter
to skip license header blocks at the beginning of source files.
"""

import os
import sys
import json
import re

# Supported source file extensions
SUPPORTED_EXTENSIONS = {
    '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
    '.py', '.pyi',
    '.java', '.kt', '.scala',
    '.go',
    '.rb',
    '.rs',
    '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
    '.cs',
    '.swift',
    '.php',
    '.lua',
    '.sql',
    '.sh', '.bash',
    '.html', '.xml', '.vue', '.svelte',
}

# Maximum lines to scan for license header
MAX_HEADER_SCAN_LINES = 50

# License detection patterns (compiled for performance)
LICENSE_PATTERNS = [
    re.compile(r'SPDX-License-Identifier:', re.IGNORECASE),
    re.compile(r'Licensed under the Apache License', re.IGNORECASE),
    re.compile(r'http://www\.apache\.org/licenses/LICENSE', re.IGNORECASE),
    re.compile(r'MIT License', re.IGNORECASE),
    re.compile(r'Permission is hereby granted,?\s*free of charge', re.IGNORECASE),
    re.compile(r'THE SOFTWARE IS PROVIDED .AS IS.', re.IGNORECASE),
    re.compile(r'GNU (General|Lesser) Public License', re.IGNORECASE),
    re.compile(r'Free Software Foundation', re.IGNORECASE),
    re.compile(r'either version \d+ of the License', re.IGNORECASE),
    re.compile(r'BSD.*License', re.IGNORECASE),
    re.compile(r'Redistribution and use in source and binary forms', re.IGNORECASE),
    re.compile(r'Copyright\s*(\(c\)|©|\d{4})', re.IGNORECASE),
    re.compile(r'All rights reserved', re.IGNORECASE),
    re.compile(r'This file is part of', re.IGNORECASE),
    re.compile(r'This source code is licensed under', re.IGNORECASE),
]


def get_comment_syntax(extension: str) -> tuple:
    """Return (block_start, block_end, line_comment) for the given extension."""
    c_style = ('/*', '*/', '//')
    python_style = ('"""', '"""', '#')
    hash_style = (None, None, '#')
    html_style = ('<!--', '-->', None)
    lua_style = ('--[[', ']]', '--')
    sql_style = ('/*', '*/', '--')

    syntax_map = {
        # C-style languages
        '.js': c_style, '.ts': c_style, '.tsx': c_style, '.jsx': c_style,
        '.mjs': c_style, '.cjs': c_style,
        '.java': c_style, '.kt': c_style, '.scala': c_style,
        '.c': c_style, '.cpp': c_style, '.cc': c_style, '.cxx': c_style,
        '.h': c_style, '.hpp': c_style, '.hxx': c_style,
        '.go': c_style, '.rs': c_style, '.swift': c_style, '.cs': c_style,
        '.php': c_style,
        # Python
        '.py': python_style, '.pyi': python_style,
        # Shell/Ruby
        '.rb': hash_style, '.sh': hash_style, '.bash': hash_style,
        # HTML/XML
        '.html': html_style, '.xml': html_style, '.vue': html_style, '.svelte': html_style,
        # Other
        '.lua': lua_style,
        '.sql': sql_style,
    }

    return syntax_map.get(extension.lower(), c_style)


def is_license_content(text: str) -> bool:
    """Check if the given text contains license-related content."""
    for pattern in LICENSE_PATTERNS:
        if pattern.search(text):
            return True
    return False


def detect_license_header(lines: list, extension: str) -> int:
    """
    Detect license header and return number of lines to skip.

    Returns 0 if no license header is detected.
    """
    if len(lines) < 3:
        return 0

    block_start, block_end, line_comment = get_comment_syntax(extension)

    # Find where comment block starts (must be in first few lines)
    comment_start = -1
    for i, line in enumerate(lines[:5]):
        stripped = line.strip()
        # Skip shebang line
        if i == 0 and stripped.startswith('#!'):
            continue
        if block_start and stripped.startswith(block_start):
            comment_start = i
            break
        elif line_comment and stripped.startswith(line_comment):
            comment_start = i
            break
        elif stripped == '':
            continue
        else:
            # Non-comment, non-blank line before finding comment
            return 0

    if comment_start == -1:
        return 0

    # Collect comment block text and find its end
    comment_text_parts = []
    in_block = False
    end_line = comment_start

    for i, line in enumerate(lines[comment_start:], start=comment_start):
        stripped = line.strip()

        # Handle block comment start
        if block_start and block_start in stripped and not in_block:
            in_block = True
            comment_text_parts.append(line)
            # Check if block ends on same line
            if block_end and block_end in stripped.split(block_start, 1)[-1]:
                end_line = i + 1
                break
            continue

        # Inside block comment
        if in_block:
            comment_text_parts.append(line)
            if block_end and block_end in stripped:
                end_line = i + 1
                break
        # Line comments
        elif line_comment and stripped.startswith(line_comment):
            comment_text_parts.append(line)
            end_line = i + 1
        # Blank lines within comment block
        elif stripped == '' and comment_text_parts:
            end_line = i + 1
        # Non-comment, non-blank line - end of header region
        else:
            break

    if not comment_text_parts:
        return 0

    # Check if the comment block contains license-related content
    comment_text = '\n'.join(comment_text_parts)
    if not is_license_content(comment_text):
        return 0

    # Skip any trailing blank lines after the license block
    while end_line < len(lines) and lines[end_line].strip() == '':
        end_line += 1

    return end_line


def load_config() -> dict:
    """Load configuration from .claude/strip-license-headers.local.md"""
    config = {
        'enabled': False,
        'max_header_lines': MAX_HEADER_SCAN_LINES,
    }

    config_path = '.claude/strip-license-headers.local.md'

    if not os.path.exists(config_path):
        return config

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Parse YAML frontmatter
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 2:
                frontmatter = parts[1]
                for line in frontmatter.split('\n'):
                    line = line.strip()
                    if line.startswith('enabled:'):
                        value = line.split(':', 1)[1].strip().lower()
                        config['enabled'] = value == 'true'
                    elif line.startswith('max_header_lines:'):
                        try:
                            value = int(line.split(':', 1)[1].strip())
                            config['max_header_lines'] = value
                        except ValueError:
                            pass
    except Exception:
        pass

    return config


def main():
    """Main entry point for the PreToolUse hook."""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        tool_name = input_data.get('tool_name', '')
        if tool_name != 'Read':
            sys.exit(0)

        tool_input = input_data.get('tool_input', {})
        file_path = tool_input.get('file_path', '')

        # Don't modify if offset is already explicitly set
        if tool_input.get('offset') is not None:
            sys.exit(0)

        # Check file extension
        _, ext = os.path.splitext(file_path)
        if ext.lower() not in SUPPORTED_EXTENSIONS:
            sys.exit(0)

        # Load configuration
        config = load_config()
        if not config.get('enabled', False):
            sys.exit(0)

        # Check if file exists and is readable
        if not os.path.isfile(file_path):
            sys.exit(0)

        # Read first N lines of the file
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                lines = []
                for i, line in enumerate(f):
                    if i >= config['max_header_lines']:
                        break
                    # Check for binary content
                    if '\x00' in line:
                        sys.exit(0)
                    lines.append(line.rstrip('\n\r'))
        except (IOError, OSError):
            sys.exit(0)

        # Detect license header
        offset = detect_license_header(lines, ext.lower())

        if offset > 0:
            result = {
                'hookSpecificOutput': {
                    'hookEventName': 'PreToolUse',
                    'permissionDecision': 'allow',
                    'updatedInput': {
                        'offset': offset
                    }
                },
                'systemMessage': f'Stripped {offset}-line license header from {os.path.basename(file_path)}'
            }
            print(json.dumps(result))

    except json.JSONDecodeError:
        pass
    except Exception:
        pass

    sys.exit(0)


if __name__ == '__main__':
    main()
