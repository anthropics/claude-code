#!/usr/bin/env python3
"""Test script for command_parser module."""

from command_parser import (
    split_compound_command,
    is_compound_command,
    format_command_breakdown,
    extract_base_commands
)


def test_split_compound_command():
    """Test splitting compound commands."""
    print("Testing split_compound_command()...")
    
    tests = [
        ("sleep 10", [('', 'sleep 10')]),
        ("sleep 10 && echo done", [('', 'sleep 10'), ('&&', 'echo done')]),
        ("cmd1 || cmd2 || cmd3", [('', 'cmd1'), ('||', 'cmd2'), ('||', 'cmd3')]),
        ("ls -la ; pwd ; whoami", [('', 'ls -la'), (';', 'pwd'), (';', 'whoami')]),
        ("cat file.txt | grep pattern", [('', 'cat file.txt'), ('|', 'grep pattern')]),
        ('echo "hello && world"', [('', 'echo "hello && world"')]),
        ("echo 'test;test' && ls", [('', "echo 'test;test'"), ('&&', 'ls')]),
    ]
    
    for cmd, expected in tests:
        result = split_compound_command(cmd)
        status = "✓" if result == expected else "✗"
        print(f"  {status} {cmd}")
        if result != expected:
            print(f"    Expected: {expected}")
            print(f"    Got:      {result}")
    print()


def test_is_compound_command():
    """Test compound command detection."""
    print("Testing is_compound_command()...")
    
    tests = [
        ("sleep 10", False),
        ("sleep 10 && echo done", True),
        ("cmd1 || cmd2", True),
        ("ls ; pwd", True),
        ("cat file | grep pattern", True),
        ('echo "hello && world"', False),
    ]
    
    for cmd, expected in tests:
        result = is_compound_command(cmd)
        status = "✓" if result == expected else "✗"
        print(f"  {status} {cmd} -> {result}")
    print()


def test_format_command_breakdown():
    """Test command breakdown formatting."""
    print("Testing format_command_breakdown()...")
    
    cmd = "sleep 10 && echo done || echo failed"
    result = format_command_breakdown(cmd)
    print(f"  Command: {cmd}")
    print(f"  Breakdown:\n{result}")
    print()


def test_extract_base_commands():
    """Test base command extraction."""
    print("Testing extract_base_commands()...")
    
    tests = [
        ("sleep 10 && echo done", ['sleep', 'echo']),
        ("sudo apt-get update", ['apt-get']),
        ("ls -la ; pwd ; whoami", ['ls', 'pwd', 'whoami']),
        ("cat file.txt | grep pattern | wc -l", ['cat', 'grep', 'wc']),
    ]
    
    for cmd, expected in tests:
        result = extract_base_commands(cmd)
        status = "✓" if result == expected else "✗"
        print(f"  {status} {cmd}")
        print(f"    -> {result}")
    print()


if __name__ == '__main__':
    test_split_compound_command()
    test_is_compound_command()
    test_format_command_breakdown()
    test_extract_base_commands()
    print("All tests completed!")
