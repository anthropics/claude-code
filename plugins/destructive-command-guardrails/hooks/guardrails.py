#!/usr/bin/env python3
"""
Destructive Command Guardrails

PreToolUse hook that blocks shell commands known to cause irreversible data loss.
Each rule targets a specific destructive pattern documented in real-world incidents.
"""

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Severity levels
# ---------------------------------------------------------------------------

CRITICAL = "CRITICAL"  # near-certain data loss, always block
HIGH = "HIGH"          # likely data loss or hard to reverse
MEDIUM = "MEDIUM"      # potentially destructive depending on context


# ---------------------------------------------------------------------------
# Detection rules
#
# Each rule is a dict with:
#   pattern  - compiled regex applied to the full command string
#   severity - CRITICAL / HIGH / MEDIUM
#   name     - short identifier for logging
#   message  - human-readable explanation shown when blocked
#
# Patterns use (?i) for case-insensitivity where appropriate (SQL keywords)
# and word boundaries to avoid false positives on substrings.
# ---------------------------------------------------------------------------

RULES = [
    # ── Filesystem deletion ────────────────────────────────────────────
    {
        "pattern": re.compile(
            r"\brm\s+.*-[a-zA-Z]*r[a-zA-Z]*f|"
            r"\brm\s+.*-[a-zA-Z]*f[a-zA-Z]*r|"
            r"\brm\s+-rf\b|"
            r"\brm\s+--no-preserve-root"
        ),
        "severity": CRITICAL,
        "name": "rm_recursive_force",
        "message": (
            "Recursive forced deletion (rm -rf). This permanently destroys "
            "files and directories with no recovery path."
        ),
    },
    {
        "pattern": re.compile(r"\brm\s+.*-[a-zA-Z]*r\b.*(/|~|\$HOME|\.\.)"),
        "severity": HIGH,
        "name": "rm_recursive_broad",
        "message": (
            "Recursive deletion targeting a broad path (/, ~, or parent dirs). "
            "This can destroy data well beyond the intended scope."
        ),
    },
    {
        "pattern": re.compile(
            r"\bfind\b.*\s-delete\b|"
            r"\bfind\b.*-exec\s+rm\b"
        ),
        "severity": HIGH,
        "name": "find_delete",
        "message": (
            "find with -delete or -exec rm can silently destroy files across "
            "an entire directory tree."
        ),
    },
    {
        "pattern": re.compile(
            r"\bRemove-Item\b.*-Recurse.*-Force|"
            r"\bRemove-Item\b.*-Force.*-Recurse"
        ),
        "severity": CRITICAL,
        "name": "powershell_remove_recursive",
        "message": (
            "PowerShell Remove-Item -Recurse -Force permanently deletes files "
            "and can traverse NTFS junctions into unrelated directories."
        ),
    },

    # ── Git destructive operations ─────────────────────────────────────
    {
        "pattern": re.compile(r"\bgit\s+reset\s+--hard\b"),
        "severity": HIGH,
        "name": "git_reset_hard",
        "message": (
            "git reset --hard discards all uncommitted changes (staged and "
            "unstaged) with no way to recover them."
        ),
    },
    {
        "pattern": re.compile(r"\bgit\s+clean\s+.*-[a-zA-Z]*f[a-zA-Z]*d|"
                              r"\bgit\s+clean\s+.*-[a-zA-Z]*d[a-zA-Z]*f"),
        "severity": HIGH,
        "name": "git_clean_fd",
        "message": (
            "git clean -fd permanently deletes all untracked files and "
            "directories. This cannot be undone."
        ),
    },
    {
        "pattern": re.compile(r"\bgit\s+push\s+.*--force\b|\bgit\s+push\s+-f\b"),
        "severity": HIGH,
        "name": "git_force_push",
        "message": (
            "git push --force overwrites remote history. Other contributors' "
            "work can be permanently lost."
        ),
    },
    {
        "pattern": re.compile(r"\bgit\s+checkout\s+--\s+\.\s*$"),
        "severity": MEDIUM,
        "name": "git_checkout_dot",
        "message": (
            "git checkout -- . discards all unstaged changes in the working "
            "directory."
        ),
    },
    {
        "pattern": re.compile(r"\bgit\s+stash\s+drop\b.*--all|"
                              r"\bgit\s+stash\s+clear\b"),
        "severity": MEDIUM,
        "name": "git_stash_clear",
        "message": (
            "git stash clear/drop --all permanently destroys all stashed "
            "changes."
        ),
    },
    {
        "pattern": re.compile(r"\bgit\s+branch\s+-D\b"),
        "severity": MEDIUM,
        "name": "git_branch_force_delete",
        "message": (
            "git branch -D force-deletes a branch even if it has unmerged "
            "changes."
        ),
    },

    # ── Database destructive operations ────────────────────────────────
    {
        "pattern": re.compile(r"\bDROP\s+(TABLE|DATABASE|SCHEMA)\b", re.IGNORECASE),
        "severity": CRITICAL,
        "name": "sql_drop",
        "message": (
            "DROP TABLE/DATABASE/SCHEMA permanently destroys data structures "
            "and all their contents."
        ),
    },
    {
        "pattern": re.compile(r"\bTRUNCATE\s+TABLE\b", re.IGNORECASE),
        "severity": CRITICAL,
        "name": "sql_truncate",
        "message": (
            "TRUNCATE TABLE removes all rows instantly without logging "
            "individual deletions. It cannot be rolled back in most engines."
        ),
    },
    {
        "pattern": re.compile(
            r"\bDELETE\s+FROM\s+\S+\s*;?\s*$|"
            r"\bDELETE\s+FROM\s+\S+\s+WHERE\s+1\s*=\s*1",
            re.IGNORECASE,
        ),
        "severity": HIGH,
        "name": "sql_delete_all",
        "message": (
            "DELETE FROM without a meaningful WHERE clause removes all rows "
            "from the table."
        ),
    },

    # ── Docker / container destructive operations ──────────────────────
    {
        "pattern": re.compile(r"\bdocker\s+system\s+prune\s+.*-a|"
                              r"\bdocker\s+system\s+prune\s+--all"),
        "severity": MEDIUM,
        "name": "docker_prune_all",
        "message": (
            "docker system prune -a removes ALL unused images, containers, "
            "networks, and build cache."
        ),
    },
    {
        "pattern": re.compile(r"\bdocker\s+volume\s+prune\b"),
        "severity": HIGH,
        "name": "docker_volume_prune",
        "message": (
            "docker volume prune deletes all unused volumes including any "
            "persistent data they contain."
        ),
    },

    # ── System-level destruction ───────────────────────────────────────
    {
        "pattern": re.compile(r"\bmkfs\b|\bmkfs\.\w+"),
        "severity": CRITICAL,
        "name": "mkfs_format",
        "message": (
            "mkfs formats a filesystem, destroying all data on the target "
            "device."
        ),
    },
    {
        "pattern": re.compile(r"\bdd\s+.*\bof=/dev/"),
        "severity": CRITICAL,
        "name": "dd_device_write",
        "message": (
            "dd writing to a block device overwrites raw data. This can "
            "destroy partitions, filesystems, and boot sectors."
        ),
    },
    {
        "pattern": re.compile(r"\bkill\s+-9\s|"
                              r"\bkill\s+-SIGKILL\s|"
                              r"\bkillall\s+-9\b|"
                              r"\bpkill\s+-9\b"),
        "severity": MEDIUM,
        "name": "kill_force",
        "message": (
            "SIGKILL (-9) terminates processes immediately with no chance to "
            "save state or flush data. Use SIGTERM first."
        ),
    },
    {
        "pattern": re.compile(r"\bsudo\s+rm\b|"
                              r"\bsudo\s+dd\b|"
                              r"\bsudo\s+mkfs\b|"
                              r"\bsudo\s+wipefs\b"),
        "severity": CRITICAL,
        "name": "sudo_destructive",
        "message": (
            "Running destructive commands with sudo bypasses all filesystem "
            "permissions. Damage will be unrecoverable."
        ),
    },

    # ── Environment / config destruction ───────────────────────────────
    {
        "pattern": re.compile(r"\b(pip|pip3)\s+uninstall\s+.*-y\b"),
        "severity": MEDIUM,
        "name": "pip_uninstall_yes",
        "message": (
            "pip uninstall -y removes packages without confirmation. "
            "This can break dependency chains."
        ),
    },
    {
        "pattern": re.compile(r"\bnpm\s+cache\s+clean\s+--force\b"),
        "severity": MEDIUM,
        "name": "npm_cache_nuke",
        "message": (
            "npm cache clean --force destroys the entire npm cache, "
            "requiring full re-download of all packages."
        ),
    },
    {
        "pattern": re.compile(
            r">\s*/dev/null\s+2>&1\s*&\s*$|"
            r">\s*/dev/null.*&\s*disown"
        ),
        "severity": MEDIUM,
        "name": "silent_background",
        "message": (
            "Running a command silenced to /dev/null and backgrounded makes "
            "it invisible and hard to stop. Ensure this is intentional."
        ),
    },
    {
        "pattern": re.compile(
            r">\s*\.(env|bashrc|zshrc|profile|gitconfig)\b|"
            r">\s*~/\.(env|bashrc|zshrc|profile|gitconfig)\b"
        ),
        "severity": HIGH,
        "name": "overwrite_dotfile",
        "message": (
            "Redirecting output into a dotfile (> .env, > .bashrc, etc.) "
            "overwrites it completely. Use >> to append instead."
        ),
    },
]


# ---------------------------------------------------------------------------
# Allowlist — patterns that look destructive but are safe in context
# ---------------------------------------------------------------------------

ALLOWLIST = [
    # rm -rf on build/temp dirs is normal
    re.compile(
        r"\brm\s+-rf\s+(node_modules|dist|build|\.cache|__pycache__|"
        r"\.next|\.nuxt|\.turbo|coverage|\.pytest_cache|\.mypy_cache|"
        r"tmp|temp|\.tmp)\b"
    ),
    # rm -rf with a clearly scoped temp path
    re.compile(r"\brm\s+-rf\s+/tmp/"),
    # git clean with dry-run is safe
    re.compile(r"\bgit\s+clean\s+.*-[a-zA-Z]*n"),
    # docker prune with --filter is scoped
    re.compile(r"\bdocker\s+.*prune\s+.*--filter\b"),
    # kill -9 on a specific PID (not a pattern kill) — single numeric arg
    re.compile(r"\bkill\s+-9\s+\d+\s*$"),
]


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOG_DIR = Path.home() / ".claude" / "security-logs"
LOG_DIR = Path(os.environ.get("CLAUDE_CONFIG_DIR", str(Path.home() / ".claude"))) / "security-logs"


def log_event(event_type: str, command: str, rule_name: str,
              severity: str, session_id: str, cwd: str):
    """Append a structured JSON event to the daily log file."""
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        log_file = LOG_DIR / f"guardrails-{datetime.now():%Y-%m-%d}.jsonl"
        entry = {
            "timestamp": datetime.now().isoformat(),
            "event": event_type,
            "session_id": session_id,
            "cwd": cwd,
            "command": command,
            "rule": rule_name,
            "severity": severity,
        }
        with open(log_file, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except OSError:
        pass  # never let logging failures block the hook


# ---------------------------------------------------------------------------
# Core detection
# ---------------------------------------------------------------------------

def check_command(command: str) -> Optional[dict]:
    """Return the first matching rule, or None if the command is safe."""
    stripped = command.strip()
    if not stripped:
        return None

    # Check allowlist first — if any allowlist pattern matches, skip all rules
    for allow_pat in ALLOWLIST:
        if allow_pat.search(stripped):
            return None

    # Check each rule
    for rule in RULES:
        if rule["pattern"].search(stripped):
            return rule

    return None


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)  # can't parse input — don't block

    tool_name = input_data.get("tool_name", "")
    if tool_name != "Bash":
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")
    session_id = input_data.get("session_id", "unknown")
    cwd = input_data.get("cwd", "")

    if not command:
        sys.exit(0)

    # Handle chained commands (&&, ||, ;, |)
    # Split on chain operators and check each segment
    segments = re.split(r"\s*(?:&&|\|\||;)\s*", command)
    # Also check piped commands (the first command in a pipe is the data source)
    for seg in segments:
        pipe_parts = seg.split("|")
        for part in pipe_parts:
            part = part.strip()
            matched_rule = check_command(part)
            if matched_rule:
                severity = matched_rule["severity"]
                name = matched_rule["name"]
                message = matched_rule["message"]

                log_event("blocked", command, name, severity, session_id, cwd)

                icon = {CRITICAL: "🛑", HIGH: "⛔", MEDIUM: "⚠️"}
                header = f"{icon.get(severity, '⚠️')}  DESTRUCTIVE COMMAND BLOCKED [{severity}]"
                divider = "=" * 60

                output = (
                    f"\n{divider}\n"
                    f"{header}\n"
                    f"{divider}\n\n"
                    f"  Rule:    {name}\n"
                    f"  Command: {command}\n\n"
                    f"  {message}\n\n"
                    f"  If this is intentional, disable this plugin or run\n"
                    f"  the command manually in your terminal.\n"
                    f"{divider}\n"
                )
                print(output, file=sys.stderr)
                sys.exit(2)  # exit 2 = block tool call, show stderr to model

    # Command is safe
    sys.exit(0)


if __name__ == "__main__":
    main()
