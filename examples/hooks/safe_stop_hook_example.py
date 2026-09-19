#!/usr/bin/env python3
"""
Claude Code Hook: Safe Stop Hook Wrapper
=========================================
This hook runs as a Stop hook and demonstrates how to run a background task
safely after a Claude session ends - without spawning unbounded processes.

## The problem this solves

Stop hooks must return valid JSON: {"decision": "...", "reason": "..."}
A common workaround is launching `claude -p` in the background via `&`, but this
has no concurrency control. Multiple session ends accumulate background processes
indefinitely, causing memory pressure and unexpected API charges.

## Safe pattern

1. Return JSON immediately so validation passes.
2. Launch the background task with a PID lock file to prevent overlap.
3. Set a hard timeout so runaway processes self-terminate.

## Hook configuration

Add to your ~/.claude/settings.json:

{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/examples/hooks/safe_stop_hook_example.py"
          }
        ]
      }
    ]
  }
}

Read more: https://docs.anthropic.com/en/docs/claude-code/hooks
"""

import json
import os
import subprocess
import sys
import tempfile
import time

# Path to the script or command you want to run after each session.
# Replace this with your actual post-session task.
BACKGROUND_TASK = ["echo", "Session ended at $(date)"]

# Maximum seconds the background task is allowed to run.
TIMEOUT_SECONDS = 60

# Lock file prevents multiple instances from overlapping.
LOCK_FILE = os.path.join(tempfile.gettempdir(), "claude-stop-hook.lock")


def _acquire_lock() -> bool:
    """Return True if we got the lock, False if another instance holds it."""
    if os.path.exists(LOCK_FILE):
        try:
            with open(LOCK_FILE) as f:
                pid = int(f.read().strip())
            # Check if the PID is still alive.
            os.kill(pid, 0)
            return False  # Process is running - skip this run.
        except (ValueError, ProcessLookupError, PermissionError):
            pass  # Stale lock - take it over.
    try:
        with open(LOCK_FILE, "w") as f:
            f.write(str(os.getpid()))
        return True
    except OSError:
        return False


def _release_lock():
    try:
        os.remove(LOCK_FILE)
    except OSError:
        pass


def _run_background_task():
    """Run the task in a subprocess with a hard timeout."""
    if not _acquire_lock():
        return  # Another instance is already running.
    try:
        proc = subprocess.Popen(
            BACKGROUND_TASK,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=isinstance(BACKGROUND_TASK, str),
        )
        deadline = time.time() + TIMEOUT_SECONDS
        while proc.poll() is None:
            if time.time() > deadline:
                proc.kill()
                break
            time.sleep(1)
    finally:
        _release_lock()


def main():
    # Always return valid JSON first. The Stop hook schema requires this.
    response = {"decision": "block", "reason": ""}
    print(json.dumps(response))

    # Now launch the background work. It runs after this process exits.
    # We use os.fork() on Unix so the parent can exit cleanly.
    # On Windows, use a detached subprocess instead.
    try:
        if hasattr(os, "fork"):
            pid = os.fork()
            if pid == 0:
                # Child process - run the task and exit.
                _run_background_task()
                sys.exit(0)
            # Parent exits immediately - hook validation complete.
        else:
            # Windows fallback: detached subprocess.
            subprocess.Popen(
                [sys.executable, __file__, "--run-task"],
                creationflags=getattr(subprocess, "DETACHED_PROCESS", 0),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
    except Exception:
        pass  # Never let background launch errors surface to the hook.


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--run-task":
        # Entry point for the Windows detached subprocess.
        _run_background_task()
    else:
        main()
