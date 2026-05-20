#!/usr/bin/env python3
"""
Claude Code Hook: Windows Bash Stability Monitor
===============================================
This hook monitors Bash commands for patterns that commonly cause 
silent exits on Windows PowerShell hosts during long-running agent sessions.

It detects:
- Dense bash subprocess chains (&& operations with many commands)
- Commands that may cause handle/memory leaks
- High-frequency bash invocations that could overwhelm PowerShell

Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks

Configuration:
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/windows_bash_stability_hook.py"
          }
        ]
      }
    ]
  }
}
"""

import json
import os
import re
import sys
import time
from datetime import datetime

# Store bash command history to detect patterns
_BASH_HISTORY_FILE = os.path.expanduser("~/.claude_bash_history.json")
_MAX_BASH_COMMANDS_PER_SESSION = 50
_WARNING_THRESHOLD = 40

# Patterns that commonly cause issues on Windows
_RISKY_PATTERNS = [
    (r"cd\s+\S+.*&&.*&&.*", "Multi-step command chain (&& &&) - consider breaking into separate commands"),
    (r".*\s+2>&1\s*\|\s*grep", "Redirect + pipe pattern - may cause handle leaks on Windows"),
    (r".*\s*\|\s*.*\s*\|\s*", "Multiple pipe operations - can overwhelm PowerShell"),
    (r"python\s+.*\.py.*\s*&&", "Python script followed by chaining - memory intensive"),
    (r".*\.py.*2>&1.*\|", "Python script with stderr redirect and pipe - high risk pattern"),
]

def _load_bash_history():
    """Load bash command history from file."""
    try:
        if os.path.exists(_BASH_HISTORY_FILE):
            with open(_BASH_HISTORY_FILE, 'r') as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        pass
    return {"commands": [], "session_start": time.time()}

def _save_bash_history(history):
    """Save bash command history to file."""
    try:
        with open(_BASH_HISTORY_FILE, 'w') as f:
            json.dump(history, f)
    except IOError:
        pass

def _analyze_command_risk(command: str) -> list[str]:
    """Analyze command for risky patterns on Windows."""
    issues = []
    for pattern, message in _RISKY_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            issues.append(message)
    return issues

def _check_bash_frequency(history: dict) -> list[str]:
    """Check if bash commands are too frequent (potential memory leak)."""
    issues = []
    command_count = len(history["commands"])
    
    if command_count >= _WARNING_THRESHOLD:
        issues.append(f"High bash command frequency: {command_count} commands this session")
        issues.append(f"Consider using 'claude --resume <uuid>' if session crashes")
        
    if command_count >= _MAX_BASH_COMMANDS_PER_SESSION:
        issues.append(f"CRITICAL: {command_count} bash commands exceeded safe limit")
        issues.append("Session at risk of silent exit - restart recommended")
    
    return issues

def _record_command(command: str):
    """Record command in history."""
    history = _load_bash_history()
    history["commands"].append({
        "command": command[:100],  # Truncate for storage
        "timestamp": time.time(),
        "datetime": datetime.now().isoformat()
    })
    
    # Keep only last 100 commands
    if len(history["commands"]) > 100:
        history["commands"] = history["commands"][-100:]
    
    _save_bash_history(history)

def main():
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

    # Check if we're on Windows
    if os.name != 'nt':
        sys.exit(0)

    # Analyze command for risky patterns
    risk_issues = _analyze_command_risk(command)
    
    # Check bash frequency
    history = _load_bash_history()
    frequency_issues = _check_bash_frequency(history)
    
    # Record this command
    _record_command(command)
    
    all_issues = risk_issues + frequency_issues
    
    if all_issues:
        print("⚠️  Windows Bash Stability Warning:", file=sys.stderr)
        print("Issue #55424: PowerShell silent exit detected patterns", file=sys.stderr)
        print("", file=sys.stderr)
        
        for issue in all_issues:
            print(f"• {issue}", file=sys.stderr)
        
        print("", file=sys.stderr)
        print("Recommendations:", file=sys.stderr)
        print("• Break complex chains into separate commands", file=sys.stderr)
        print("• Use PowerShell directly for complex operations", file=sys.stderr)
        print("• Restart session if approaching command limits", file=sys.stderr)
        print("• Consider upgrading to v2.1.126+ for Windows improvements", file=sys.stderr)
        
        # Critical warning for high frequency
        if len(history["commands"]) >= _MAX_BASH_COMMANDS_PER_SESSION:
            print("", file=sys.stderr)
            print("🚨 CRITICAL: Session at high risk of silent exit!", file=sys.stderr)
            print("Consider saving work and restarting Claude Code.", file=sys.stderr)
            # Exit code 2 blocks tool call and shows warning to Claude
            sys.exit(2)

if __name__ == "__main__":
    main()
