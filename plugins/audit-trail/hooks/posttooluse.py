#!/usr/bin/env python3
"""PostToolUse audit hook for comprehensive tool result logging.

This hook logs all tool results AFTER execution, capturing:
- Timestamp
- Session ID
- Tool name and result status
- Execution duration (when paired with PreToolUse)
- Output summary (truncated for large outputs)

Logs are written to ~/.claude/audit/<date>.jsonl in append mode.

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
    config_dir = os.environ.get('CLAUDE_CONFIG_DIR', os.path.expanduser('~/.claude'))
    audit_dir = Path(config_dir) / 'audit'
    audit_dir.mkdir(parents=True, exist_ok=True)
    return audit_dir


def get_session_id() -> str:
    """Extract or generate a session identifier."""
    session_id = os.environ.get('CLAUDE_SESSION_ID', '')
    if not session_id:
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


def summarize_output(output: any, max_length: int = 500) -> str:
    """Create a summary of tool output for logging."""
    if output is None:
        return "[no output]"

    if isinstance(output, str):
        if len(output) <= max_length:
            return output
        return output[:max_length] + f"... [truncated, {len(output)} chars total]"

    if isinstance(output, dict):
        # For dicts, create a summary
        summary = json.dumps(output, ensure_ascii=False)
        if len(summary) <= max_length:
            return summary
        return summary[:max_length] + f"... [truncated]"

    return str(output)[:max_length]


def determine_result_status(input_data: dict) -> str:
    """Determine if the tool execution was successful."""
    tool_result = input_data.get('tool_result', {})

    # Check for error indicators
    if isinstance(tool_result, dict):
        if tool_result.get('is_error', False):
            return 'error'
        if 'error' in str(tool_result).lower()[:100]:
            return 'possible_error'

    # Check if there's output
    if tool_result:
        return 'success'

    return 'unknown'


def create_audit_record(input_data: dict, event_type: str) -> dict:
    """Create a structured audit record for post-tool-use."""
    now = datetime.now(timezone.utc)
    tool_name = input_data.get('tool_name', 'unknown')
    tool_input = input_data.get('tool_input', {})
    tool_result = input_data.get('tool_result', {})

    record = {
        "timestamp": now.isoformat(),
        "timestamp_unix": now.timestamp(),
        "event_type": event_type,
        "session_id": get_session_id(),
        "tool": {
            "name": tool_name,
            "category": categorize_tool(tool_name),
        },
        "result": {
            "status": determine_result_status(input_data),
            "output_summary": summarize_output(tool_result),
        },
        "context": {
            "cwd": os.getcwd(),
        }
    }

    # Add tool-specific result info
    if tool_name == 'Bash':
        record["tool"]["command"] = tool_input.get('command', '')[:200]
        # Check for exit code in result
        result_str = str(tool_result)
        if 'exit code' in result_str.lower():
            record["result"]["has_exit_code"] = True

    elif tool_name in ['Write', 'Edit']:
        record["tool"]["file_path"] = tool_input.get('file_path', '')
        record["result"]["file_modified"] = True

    elif tool_name == 'Read':
        record["tool"]["file_path"] = tool_input.get('file_path', '')
        # Don't log file contents for privacy
        record["result"]["output_summary"] = f"[file read: {len(str(tool_result))} chars]"

    return record


def write_audit_log(record: dict) -> None:
    """Append audit record to daily JSONL file."""
    audit_dir = get_audit_dir()
    date_str = datetime.now().strftime('%Y-%m-%d')
    log_file = audit_dir / f"audit-{date_str}.jsonl"

    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps(record, ensure_ascii=False) + '\n')


def main():
    """Main entry point for PostToolUse audit hook."""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        # Create and write audit record
        record = create_audit_record(input_data, "post_tool_use")
        write_audit_log(record)

        # Output empty JSON to allow operation to proceed
        print(json.dumps({}), file=sys.stdout)

    except Exception as e:
        # On any error, log to stderr but allow operation
        print(f"Audit hook error: {e}", file=sys.stderr)
        print(json.dumps({}), file=sys.stdout)

    finally:
        # Always exit 0
        sys.exit(0)


if __name__ == '__main__':
    main()
