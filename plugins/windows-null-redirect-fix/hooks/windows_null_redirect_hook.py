#!/usr/bin/env python3
"""
Claude Code Hook: Windows Null Redirect Fix
============================================
This hook runs as a PreToolUse hook for the Bash tool on Windows.
It detects when bash commands incorrectly use 'nul' for output redirection
and blocks execution with a helpful message to use '/dev/null' instead.

Issue: https://github.com/anthropics/claude-code/issues/23343

Background:
- On Windows CMD: NUL is the null device
- On PowerShell: $null is the null device
- On Git Bash/MSYS: /dev/null is the null device
- Using bare 'nul' in Git Bash creates a file named 'nul' instead of discarding output

This is problematic because:
1. NUL is a reserved device name on Windows
2. Files named 'nul' can be difficult to delete via Windows Explorer
3. May cause issues with backup software, antivirus scanners, and sync tools
4. Confuses Windows applications that expect these to be device names

Solution:
In Git Bash contexts on Windows, always use /dev/null for output redirection.
"""

import json
import os
import re
import sys
from typing import Optional, Tuple

# Patterns that indicate incorrect null device usage in bash on Windows
# These patterns match common redirection to 'nul' which should be '/dev/null'
NUL_REDIRECT_PATTERNS = [
    # Standard output redirection to nul
    (r'>\s*nul\b', '> /dev/null'),
    (r'1>\s*nul\b', '1> /dev/null'),
    # Standard error redirection to nul
    (r'2>\s*nul\b', '2> /dev/null'),
    # Both stdout and stderr to nul
    (r'&>\s*nul\b', '&> /dev/null'),
    (r'>\s*nul\s+2>&1', '> /dev/null 2>&1'),
    (r'2>&1\s*>\s*nul', '2>&1 > /dev/null'),
    # Append redirections
    (r'>>\s*nul\b', '>> /dev/null'),
    (r'2>>\s*nul\b', '2>> /dev/null'),
]

# Also catch Windows CMD style with NUL (case insensitive)
NUL_PATTERNS_CASE_INSENSITIVE = [
    (r'>\s*NUL\b', '> /dev/null'),
    (r'2>\s*NUL\b', '2> /dev/null'),
    (r'&>\s*NUL\b', '&> /dev/null'),
]


def is_windows() -> bool:
    """Check if running on Windows."""
    return os.name == 'nt' or 'windows' in os.environ.get('OS', '').lower()


def detect_nul_redirect(command: str) -> Optional[Tuple[str, str]]:
    """
    Detect if the command uses 'nul' redirection that should be '/dev/null'.
    
    Returns:
        Tuple of (matched_pattern, suggested_fix) if found, None otherwise
    """
    # Check case-sensitive patterns first
    for pattern, fix in NUL_REDIRECT_PATTERNS:
        match = re.search(pattern, command)
        if match:
            return (match.group(), fix)
    
    # Check case-insensitive patterns (for CMD-style NUL)
    for pattern, fix in NUL_PATTERNS_CASE_INSENSITIVE:
        match = re.search(pattern, command, re.IGNORECASE)
        if match:
            return (match.group(), fix)
    
    return None


def suggest_fixed_command(command: str) -> str:
    """
    Return the command with nul redirections fixed to /dev/null.
    """
    fixed = command
    
    # Apply all pattern fixes
    for pattern, fix in NUL_REDIRECT_PATTERNS:
        fixed = re.sub(pattern, fix, fixed)
    
    for pattern, fix in NUL_PATTERNS_CASE_INSENSITIVE:
        fixed = re.sub(pattern, fix, fixed, flags=re.IGNORECASE)
    
    return fixed


def main():
    # Only run on Windows
    if not is_windows():
        sys.exit(0)
    
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)
    
    tool_name = input_data.get("tool_name", "")
    if tool_name != "Bash":
        sys.exit(0)
    
    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")
    
    if not command:
        sys.exit(0)
    
    # Check for nul redirect patterns
    detection = detect_nul_redirect(command)
    
    if detection:
        matched, suggested = detection
        fixed_command = suggest_fixed_command(command)
        
        error_message = f"""⚠️ Windows Null Device Warning (Issue #23343)

Detected '{matched}' redirection in bash command.

On Windows with Git Bash/MSYS, using 'nul' creates a literal file named 'nul' 
instead of discarding output. This file:
- Uses a reserved Windows device name
- Can be difficult to delete via Windows Explorer
- May cause issues with backup/sync software

✅ Suggested fix: Use '/dev/null' instead of 'nul'

Original command:
  {command}

Fixed command:
  {fixed_command}

Context:
- Windows CMD uses: NUL
- PowerShell uses: $null  
- Git Bash/MSYS uses: /dev/null

For more information, see: https://github.com/anthropics/claude-code/issues/23343
"""
        print(error_message, file=sys.stderr)
        # Exit code 2 blocks tool call and shows stderr to Claude
        sys.exit(2)
    
    # Allow command to proceed
    sys.exit(0)


if __name__ == "__main__":
    main()
