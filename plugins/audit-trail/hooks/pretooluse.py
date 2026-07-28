#!/usr/bin/env python3
"""PreToolUse audit hook for comprehensive tool usage logging.

This hook logs all tool calls BEFORE execution, capturing:
- Timestamp
- Session ID
- Tool name and category
- Tool input/arguments
- Request context

Logs are written to ~/.claude/audit/<date>.jsonl in append mode.

For compliance environments (HIPAA, SOC2, ERISA), this provides
an immutable audit trail of all AI agent actions.

Author: Steven Elliott
License: MIT
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
import hashlib


def get_audit_dir() -> Path:
    """Get or create the audit log directory."""
    # Respect CLAUDE_CONFIG_DIR if set, otherwise use ~/.claude
    config_dir = os.environ.get('CLAUDE_CONFIG_DIR', os.path.expanduser('~/.claude'))
    audit_dir = Path(config_dir) / 'audit'
    audit_dir.mkdir(parents=True, exist_ok=True)
    return audit_dir


def get_session_id() -> str:
    """Extract or generate a session identifier."""
    # Try to get from environment or generate from timestamp
    session_id = os.environ.get('CLAUDE_SESSION_ID', '')
    if not session_id:
        # Generate a session ID from the current working directory and time
        cwd = os.getcwd()
        session_id = hashlib.md5(f"{cwd}-{datetime.now().date()}".encode()).hexdigest()[:12]
    return session_id


def categorize_tool(tool_name: str) -> str:
    """Categorize tool for filtering and reporting."""
    categories = {
        'Bash': 'execution',
        'Read': 'file_read',
        'Write': 'file_write',
        'Edit': 'file_write',
        'MultiEdit': 'file_write',
        'Glob': 'file_search',
        'Grep': 'file_search',
        'WebFetch': 'network',
        'WebSearch': 'network',
        'Task': 'agent',
        'AskUserQuestion': 'interaction',
    }
    return categories.get(tool_name, 'other')


def sanitize_sensitive_data(data: dict) -> dict:
    """Remove or mask potentially sensitive information.

    In compliance environments, we want to log WHAT happened
    but may need to redact sensitive content.
    """
    sensitive_patterns = [
        'password', 'secret', 'token', 'api_key', 'apikey',
        'credential', 'private_key', 'auth'
    ]

    def redact_value(key: str, value) -> any:
        key_lower = key.lower()
        for pattern in sensitive_patterns:
            if pattern in key_lower:
                if isinstance(value, str):
                    return f"[REDACTED-{len(value)} chars]"
                return "[REDACTED]"
        return value

    if isinstance(data, dict):
        return {k: redact_value(k, sanitize_sensitive_data(v)) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_sensitive_data(item) for item in data]
    return data


def create_audit_record(input_data: dict, event_type: str) -> dict:
    """Create a structured audit record."""
    now = datetime.now(timezone.utc)
    tool_name = input_data.get('tool_name', 'unknown')
    tool_input = input_data.get('tool_input', {})

    # Create the audit record
    record = {
        "timestamp": now.isoformat(),
        "timestamp_unix": now.timestamp(),
        "event_type": event_type,
        "session_id": get_session_id(),
        "tool": {
            "name": tool_name,
            "category": categorize_tool(tool_name),
        },
        "request": sanitize_sensitive_data(tool_input),
        "context": {
            "cwd": os.getcwd(),
            "user": os.environ.get('USER', 'unknown'),
            "config_dir": os.environ.get('CLAUDE_CONFIG_DIR', '~/.claude'),
        }
    }

    # Add specific fields based on tool type
    if tool_name == 'Bash':
        record["tool"]["command"] = tool_input.get('command', '')[:500]  # Truncate long commands
    elif tool_name in ['Read', 'Write', 'Edit']:
        record["tool"]["file_path"] = tool_input.get('file_path', '')
    elif tool_name == 'WebFetch':
        record["tool"]["url"] = tool_input.get('url', '')

    return record


def write_audit_log(record: dict) -> None:
    """Append audit record to daily JSONL file."""
    audit_dir = get_audit_dir()
    date_str = datetime.now().strftime('%Y-%m-%d')
    log_file = audit_dir / f"audit-{date_str}.jsonl"

    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps(record, ensure_ascii=False) + '\n')


def main():
    """Main entry point for PreToolUse audit hook."""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        # Create and write audit record
        record = create_audit_record(input_data, "pre_tool_use")
        write_audit_log(record)

        # Output empty JSON to allow operation to proceed
        # We never block operations - this is observational only
        print(json.dumps({}), file=sys.stdout)

    except Exception as e:
        # On any error, log to stderr but allow operation
        print(f"Audit hook error: {e}", file=sys.stderr)
        print(json.dumps({}), file=sys.stdout)

    finally:
        # Always exit 0 - never block operations due to audit failures
        sys.exit(0)


if __name__ == '__main__':
    main()
