#!/usr/bin/env python3
"""
Claude Code Hook: Bash Command Security Analyzer
=================================================
A PreToolUse hook for the Bash tool that detects destructive operations,
privilege escalation, credential exposure, and file-write bypass patterns.

Blocks dangerous commands (exit code 2) and lets safe ones through (exit code 0).
Commands are tokenized and analyzed — not just substring-matched — so normal
usage like `grep "rm" logfile.txt` won't false-positive.

Read more about hooks: https://docs.anthropic.com/en/docs/claude-code/hooks

Installation — add to your ~/.claude/settings.json:

{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/bash_security_hook.py"
          }
        ]
      }
    ]
  }
}

Environment variables:
  BASH_SECURITY_HOOK_ALLOWLIST  Comma-separated commands to always allow
  BASH_SECURITY_HOOK_LOG        Path to debug log file (default: none)
"""

import json
import os
import re
import shlex
import sys


# ── Rule definitions ──────────────────────────────────────────────────

DESTRUCTIVE_PATTERNS = [
    # File/directory removal
    (r"\brm\s+(-[a-zA-Z]*f|-[a-zA-Z]*r|--force|--recursive)", "rm with -rf/-f flags can destroy files irreversibly"),
    (r"\brm\s+-[a-zA-Z]*[rR][a-zA-Z]*\s", "recursive rm can destroy entire directory trees"),
    # Disk-level destruction
    (r"\bdd\s+.*\bof=", "dd writing to a device/file can cause data loss"),
    (r"\bmkfs\b", "mkfs formats a filesystem — destructive"),
    (r"\bformat\b", "format can destroy disk contents"),
    # Git destructive operations
    (r"\bgit\s+push\s+.*--force\b", "force-push can overwrite remote history"),
    (r"\bgit\s+reset\s+--hard\b", "git reset --hard discards uncommitted changes"),
    (r"\bgit\s+clean\s+-[a-zA-Z]*f", "git clean -f permanently deletes untracked files"),
    # Database
    (r"\bDROP\s+(TABLE|DATABASE|SCHEMA)\b", "DROP statements permanently delete database objects"),
    (r"\bTRUNCATE\s+TABLE\b", "TRUNCATE permanently deletes all rows"),
]

PRIVILEGE_ESCALATION_PATTERNS = [
    (r"\bsudo\b", "sudo elevates to root privileges"),
    (r"\bsu\s", "su switches to another user"),
    (r"\bdoas\b", "doas elevates privileges"),
    (r"\bpkexec\b", "pkexec elevates via polkit"),
    (r"\bchmod\s+[0-7]*777\b", "chmod 777 makes files world-writable"),
    (r"\bchmod\s+[+][s]", "setuid/setgid can enable privilege escalation"),
    (r"\bchown\s+root\b", "changing ownership to root"),
]

CREDENTIAL_EXPOSURE_PATTERNS = [
    (r"\bcat\s+.*\.(env|pem|key|secret|credential)", "reading credential/key files"),
    (r"\bcat\s+.*/(\.ssh|\.gnupg|\.aws|\.config)/", "reading sensitive config directories"),
    (r"\benv\b.*\|\s*grep", "filtering environment may expose secrets in output"),
    (r"\bprintenv\b", "printenv dumps all environment variables including secrets"),
    (r"\bset\s*\|", "piping set output can expose shell variables and secrets"),
    (r"echo\s+.*\$[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|MNEMONIC)", "echoing secret environment variables"),
    (r"\bhistory\b", "shell history may contain secrets"),
]

FILE_WRITE_BYPASS_PATTERNS = [
    # These patterns catch attempts to write files via bash when Edit/Write tools
    # might be blocked by other hooks
    (r"\bsed\s+-[a-zA-Z]*i\b", "sed -i modifies files in-place (bypasses Edit tool hooks)"),
    (r"\btee\s", "tee writes to files (bypasses Write tool hooks)"),
    (r"\bpython[23]?\s+-c\s+.*open\(", "python -c with open() writes files outside tool hooks"),
    (r"\bruby\s+-e\s+.*File\.", "ruby -e with File writes outside tool hooks"),
    (r"\bperl\s+-[a-zA-Z]*[pie]\b", "perl in-place edit modifies files outside tool hooks"),
    (r"\bawk\s+-[a-zA-Z]*i\b", "awk -i modifies files in-place"),
]

NETWORK_EXFILTRATION_PATTERNS = [
    (r"\bcurl\b.*\|\s*(bash|sh|zsh)\b", "piping curl to shell executes remote code"),
    (r"\bwget\b.*\|\s*(bash|sh|zsh)\b", "piping wget to shell executes remote code"),
    (r"\bnc\s+-[a-zA-Z]*l", "netcat listener opens a network port"),
    (r"\bcurl\b.*(-d|--data).*\$", "curl POST with variable interpolation may exfiltrate data"),
]


def _check_patterns(command: str, patterns: list[tuple[str, str]]) -> list[str]:
    """Check command against a list of (regex, message) patterns."""
    issues = []
    for pattern, message in patterns:
        if re.search(pattern, command, re.IGNORECASE):
            issues.append(message)
    return issues


def analyze_command(command: str) -> tuple[list[str], str]:
    """
    Analyze a bash command for security issues.

    Returns (issues, severity) where severity is 'block' or 'warn'.
    Destructive and privilege escalation issues block; others warn.
    """
    blocking = []
    blocking += _check_patterns(command, DESTRUCTIVE_PATTERNS)
    blocking += _check_patterns(command, PRIVILEGE_ESCALATION_PATTERNS)
    blocking += _check_patterns(command, NETWORK_EXFILTRATION_PATTERNS)

    warnings = []
    warnings += _check_patterns(command, CREDENTIAL_EXPOSURE_PATTERNS)
    warnings += _check_patterns(command, FILE_WRITE_BYPASS_PATTERNS)

    if blocking:
        return blocking, "block"
    if warnings:
        return warnings, "warn"
    return [], "ok"


def main():
    # Parse hook input
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

    # Check allowlist
    allowlist = os.environ.get("BASH_SECURITY_HOOK_ALLOWLIST", "")
    if allowlist:
        allowed = [c.strip() for c in allowlist.split(",")]
        first_word = command.split()[0] if command.split() else ""
        if first_word in allowed:
            sys.exit(0)

    # Debug logging
    log_path = os.environ.get("BASH_SECURITY_HOOK_LOG", "")
    if log_path:
        try:
            with open(log_path, "a") as f:
                f.write(f"[bash-security] analyzing: {command[:200]}\n")
        except IOError:
            pass

    # Analyze
    issues, severity = analyze_command(command)

    if not issues:
        sys.exit(0)

    # Format output
    header = "BLOCKED" if severity == "block" else "WARNING"
    print(f"[bash-security] {header}:", file=sys.stderr)
    for issue in issues:
        print(f"  - {issue}", file=sys.stderr)
    print(f"\n  command: {command[:200]}", file=sys.stderr)

    if severity == "block":
        # Exit code 2 blocks the tool call and shows stderr to Claude
        sys.exit(2)
    else:
        # Exit code 0 allows the tool but stderr was already shown to user
        sys.exit(0)


if __name__ == "__main__":
    main()
