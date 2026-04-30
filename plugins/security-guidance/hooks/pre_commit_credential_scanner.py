#!/usr/bin/env python3
"""
Pre-commit credential scanner hook for Claude Code.
Intercepts git commit Bash calls and scans staged content for known credential patterns.
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime

DEBUG_LOG_FILE = "/tmp/pre-commit-scanner-log.txt"

CREDENTIAL_PATTERNS = [
    (re.compile(r'AIza[0-9A-Za-z_-]{35}'), 'Google API key'),
    (re.compile(r'AKIA[0-9A-Z]{16}'), 'AWS access key ID'),
    (re.compile(r'ghp_[a-zA-Z0-9]{36}'), 'GitHub personal access token'),
    (re.compile(r'gho_[a-zA-Z0-9]{36}'), 'GitHub OAuth token'),
    (re.compile(r'ghs_[a-zA-Z0-9]{36}'), 'GitHub app token'),
    (re.compile(r'xoxb-[0-9]+-[a-zA-Z0-9-]+'), 'Slack bot token'),
    (re.compile(r'xoxp-[0-9]+-[a-zA-Z0-9-]+'), 'Slack user token'),
    (re.compile(r'fc-[a-f0-9]{32,}'), 'Firecrawl API key'),
]

SENSITIVE_FILENAME = re.compile(r'\.env$|\.env\.|credentials|secrets|api_keys')


def debug_log(message):
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


def redact(value, keep=10):
    return value[:keep] + "..." if len(value) > keep else value + "..."


def scan_diff(diff_text):
    """Return list of (description, filename) tuples for detected issues."""
    findings = []
    current_file = None

    for line in diff_text.splitlines():
        if line.startswith("diff --git "):
            # Extract filename from "diff --git a/<path> b/<path>"
            parts = line.split(" b/", 1)
            if len(parts) == 2:
                current_file = parts[1]
                if SENSITIVE_FILENAME.search(current_file):
                    findings.append((f"Sensitive file staged: {current_file}", current_file))
            continue

        if line.startswith("+++"):
            continue

        if not line.startswith("+"):
            continue

        content = line[1:]
        for pattern, label in CREDENTIAL_PATTERNS:
            match = pattern.search(content)
            if match:
                findings.append((
                    f"{label} in {current_file or 'unknown'}: {redact(match.group())}",
                    current_file,
                ))

    return findings


def main():
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except (json.JSONDecodeError, Exception) as e:
        debug_log(f"Failed to parse hook input: {e}")
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    if tool_name != "Bash":
        sys.exit(0)

    command = input_data.get("tool_input", {}).get("command", "")
    if "git commit" not in command:
        sys.exit(0)

    try:
        result = subprocess.run(
            ["git", "diff", "--cached"],
            capture_output=True,
            text=True,
            cwd=os.getcwd(),
        )
        diff_text = result.stdout
    except Exception as e:
        debug_log(f"git diff --cached failed: {e}")
        sys.exit(0)

    findings = scan_diff(diff_text)
    if not findings:
        sys.exit(0)

    lines = ["🚨 Potential credentials detected in staged changes:"]
    for description, _ in findings:
        lines.append(f"  - {description}")
    lines.append("")
    lines.append("Remove credentials before committing. Use environment variables or a secrets manager instead.")
    lines.append("")
    lines.append("Note: Generic passwords without known prefixes (e.g. Gmail app passwords) are not")
    lines.append("auto-detected. Review sensitive files manually before committing.")

    print("\n".join(lines), file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
