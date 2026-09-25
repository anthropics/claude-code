#!/usr/bin/env python3
"""Command parsing utilities for hookify plugin.

Provides functions to parse compound shell commands and extract individual components.
"""

import re
from typing import List, Tuple


def split_compound_command(command: str) -> List[Tuple[str, str]]:
    """Split a compound shell command into individual commands with their operators.
    
    Handles common shell operators: &&, ||, ;, |
    
    Args:
        command: Shell command string (e.g., "sleep 10 && echo done")
        
    Returns:
        List of (operator, command) tuples. First tuple has empty operator.
        Example: [('', 'sleep 10'), ('&&', 'echo done')]
    """
    if not command:
        return []
    
    # Pattern to match shell operators while preserving quoted strings
    # This is a simplified parser - full shell parsing is complex
    parts = []
    current_cmd = []
    i = 0
    in_quote = None
    last_operator = ''
    
    while i < len(command):
        char = command[i]
        
        # Handle quotes
        if char in ('"', "'") and (i == 0 or command[i-1] != '\\'):
            if in_quote == char:
                in_quote = None
            elif in_quote is None:
                in_quote = char
            current_cmd.append(char)
            i += 1
            continue
        
        # If we're in a quote, just append
        if in_quote:
            current_cmd.append(char)
            i += 1
            continue
        
        # Check for operators (only when not in quotes)
        if i < len(command) - 1:
            two_char = command[i:i+2]
            if two_char in ('&&', '||'):
                # Save current command
                cmd_str = ''.join(current_cmd).strip()
                if cmd_str:
                    parts.append((last_operator, cmd_str))
                last_operator = two_char
                current_cmd = []
                i += 2
                continue
        
        # Single character operators
        if char in (';', '|'):
            # For pipe, check if it's not ||
            if char == '|' and i < len(command) - 1 and command[i+1] == '|':
                current_cmd.append(char)
                i += 1
                continue
            
            cmd_str = ''.join(current_cmd).strip()
            if cmd_str:
                parts.append((last_operator, cmd_str))
            last_operator = char
            current_cmd = []
            i += 1
            continue
        
        current_cmd.append(char)
        i += 1
    
    # Add final command
    cmd_str = ''.join(current_cmd).strip()
    if cmd_str:
        parts.append((last_operator, cmd_str))
    
    return parts


def is_compound_command(command: str) -> bool:
    """Check if a command contains multiple operations.
    
    Args:
        command: Shell command string
        
    Returns:
        True if command contains &&, ||, ;, or | operators
    """
    parts = split_compound_command(command)
    return len(parts) > 1


def format_command_breakdown(command: str) -> str:
    """Format a compound command into a readable breakdown.
    
    Args:
        command: Shell command string
        
    Returns:
        Formatted string showing each command component
    """
    parts = split_compound_command(command)
    
    if len(parts) <= 1:
        return f"Single command: `{command}`"
    
    lines = []
    for i, (operator, cmd) in enumerate(parts, 1):
        if operator:
            op_desc = {
                '&&': 'THEN (if successful)',
                '||': 'OR (if failed)',
                ';': 'THEN (regardless)',
                '|': 'PIPE output to'
            }.get(operator, operator)
            lines.append(f"{i}. {op_desc}: `{cmd}`")
        else:
            lines.append(f"{i}. First: `{cmd}`")
    
    return '\n'.join(lines)


def extract_base_commands(command: str) -> List[str]:
    """Extract just the base command names (first word) from a compound command.
    
    Args:
        command: Shell command string
        
    Returns:
        List of base command names (e.g., ['sleep', 'echo', 'rm'])
    """
    parts = split_compound_command(command)
    base_commands = []
    
    for _, cmd in parts:
        # Extract first word (the actual command)
        words = cmd.strip().split()
        if words:
            # Handle sudo, env, etc.
            if words[0] in ('sudo', 'env', 'time'):
                if len(words) > 1:
                    base_commands.append(words[1])
                else:
                    base_commands.append(words[0])
            else:
                base_commands.append(words[0])
    
    return base_commands
