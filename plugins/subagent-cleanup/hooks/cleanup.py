#!/usr/bin/env python3
"""
Subagent Cleanup Hook

Terminates orphaned Claude subagent processes (spawned via the Agent tool)
that were not properly cleaned up from previous sessions.

Runs at SessionStart so each new session starts with a clean process table.
Only kills subagent processes (identified by --resume flag), never the
current interactive session.
"""

import os
import signal
import subprocess
import sys


def get_orphaned_subagents():
    """Find claude subagent processes that are likely orphaned.

    Subagents are identified by the --resume flag in their command line.
    The current process's parent chain is excluded to avoid killing
    the active session.
    """
    try:
        result = subprocess.run(
            ["ps", "axo", "pid,ppid,command"],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return []

    current_pid = os.getpid()

    # Build set of ancestor PIDs to protect the current session chain
    protected_pids = set()
    try:
        pid = current_pid
        while pid > 1:
            protected_pids.add(pid)
            # Read parent PID
            result_ppid = subprocess.run(
                ["ps", "-o", "ppid=", "-p", str(pid)],
                capture_output=True,
                text=True,
                timeout=2,
            )
            ppid_str = result_ppid.stdout.strip()
            if not ppid_str:
                break
            pid = int(ppid_str)
    except (ValueError, subprocess.TimeoutExpired):
        pass

    orphaned = []
    for line in result.stdout.strip().split("\n")[1:]:  # Skip header
        parts = line.split(None, 2)
        if len(parts) < 3:
            continue

        try:
            pid = int(parts[0])
        except ValueError:
            continue

        command = parts[2]

        # Match subagent processes: claude with --resume flag
        if "claude" in command and "--resume" in command:
            if pid not in protected_pids:
                orphaned.append(pid)

    return orphaned


def main():
    orphaned = get_orphaned_subagents()

    if not orphaned:
        return

    killed = 0
    for pid in orphaned:
        try:
            os.kill(pid, signal.SIGTERM)
            killed += 1
        except (ProcessLookupError, PermissionError):
            pass

    if killed > 0:
        print(
            f"Cleaned up {killed} orphaned subagent process{'es' if killed != 1 else ''}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
