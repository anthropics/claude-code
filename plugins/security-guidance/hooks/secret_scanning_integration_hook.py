#!/usr/bin/env python3
"""
Secret Scanning Integration Hook for Claude Code

This hook integrates with existing secret scanning tools (TruffleHog, GitLeaks)
rather than reinventing detection patterns. It follows the guidance from
@ddworken in PR #15040: leverage well-maintained external tools.

When Claude Code performs git commits, this hook:
1. Checks if TruffleHog or GitLeaks is installed
2. If installed: runs the tool on staged files before committing
3. If not installed: warns the user and recommends installation

Related issues:
- #2142: Gmail, Maps, Firecrawl API keys committed despite CLAUDE.md rules
- #12524: $30,000 USD fraud + employment termination from Azure key exposure
"""

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime

# Debug log file
DEBUG_LOG_FILE = "/tmp/secret-scanning-log.txt"

# Warning shown flag file (per session)
WARNING_SHOWN_PREFIX = "/tmp/claude_secret_scan_warning_shown_"


def debug_log(message):
    """Append debug message to log file with timestamp."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


def check_tool_installed(tool_name):
    """Check if a security scanning tool is installed and accessible."""
    return shutil.which(tool_name) is not None


def get_staged_files():
    """Get list of staged files for the current commit."""
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return [f for f in result.stdout.strip().split("\n") if f]
        return []
    except Exception as e:
        debug_log(f"Failed to get staged files: {e}")
        return []


def run_trufflehog(staged_files):
    """Run TruffleHog on staged files."""
    if not staged_files:
        return True, ""

    try:
        # TruffleHog can scan git repo for staged changes
        result = subprocess.run(
            ["trufflehog", "git", "file://.", "--only-verified", "--fail", "--no-update"],
            capture_output=True,
            text=True,
            timeout=120
        )

        if result.returncode != 0:
            return False, result.stdout + result.stderr
        return True, ""
    except subprocess.TimeoutExpired:
        debug_log("TruffleHog timed out")
        return True, ""  # Don't block on timeout
    except Exception as e:
        debug_log(f"TruffleHog error: {e}")
        return True, ""  # Don't block on error


def run_gitleaks(staged_files):
    """Run GitLeaks on staged files."""
    if not staged_files:
        return True, ""

    try:
        # GitLeaks can scan staged changes
        result = subprocess.run(
            ["gitleaks", "protect", "--staged", "--exit-code", "1"],
            capture_output=True,
            text=True,
            timeout=120
        )

        if result.returncode != 0:
            return False, result.stdout + result.stderr
        return True, ""
    except subprocess.TimeoutExpired:
        debug_log("GitLeaks timed out")
        return True, ""
    except Exception as e:
        debug_log(f"GitLeaks error: {e}")
        return True, ""


def warning_already_shown(session_id):
    """Check if we've already shown the installation warning this session."""
    warning_file = f"{WARNING_SHOWN_PREFIX}{session_id}"
    return os.path.exists(warning_file)


def mark_warning_shown(session_id):
    """Mark that we've shown the installation warning."""
    warning_file = f"{WARNING_SHOWN_PREFIX}{session_id}"
    try:
        with open(warning_file, "w") as f:
            f.write(datetime.now().isoformat())
    except Exception:
        pass


def is_git_commit_command(command):
    """Check if the bash command is a git commit."""
    if not command:
        return False

    # Common patterns for git commit commands
    commit_patterns = [
        "git commit",
        "git commit -m",
        "git commit -am",
        "git commit --amend",
    ]

    command_lower = command.lower().strip()
    return any(pattern in command_lower for pattern in commit_patterns)


def main():
    """Main hook function."""
    # Check if secret scanning is disabled
    if os.environ.get("DISABLE_SECRET_SCANNING", "0") == "1":
        sys.exit(0)

    # Read input from stdin
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except json.JSONDecodeError as e:
        debug_log(f"JSON decode error: {e}")
        sys.exit(0)

    session_id = input_data.get("session_id", "default")
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Only intercept Bash commands
    if tool_name != "Bash":
        sys.exit(0)

    command = tool_input.get("command", "")

    # Only check git commit commands
    if not is_git_commit_command(command):
        sys.exit(0)

    debug_log(f"Intercepted git commit command: {command[:100]}...")

    # Check for installed security tools
    has_trufflehog = check_tool_installed("trufflehog")
    has_gitleaks = check_tool_installed("gitleaks")

    if has_trufflehog or has_gitleaks:
        # Get staged files
        staged_files = get_staged_files()

        if staged_files:
            debug_log(f"Scanning {len(staged_files)} staged files...")

            # Run available tool
            if has_trufflehog:
                debug_log("Running TruffleHog...")
                is_clean, output = run_trufflehog(staged_files)
                tool_used = "TruffleHog"
            else:
                debug_log("Running GitLeaks...")
                is_clean, output = run_gitleaks(staged_files)
                tool_used = "GitLeaks"

            if not is_clean:
                # Secrets detected - block commit
                error_message = f"""
🚨 SECRET DETECTED - COMMIT BLOCKED 🚨

{tool_used} found potential secrets in your staged files:

{output[:2000]}{"..." if len(output) > 2000 else ""}

Action required:
1. Remove the secret from your code
2. Use environment variables or a secrets manager
3. Add the file to .gitignore if it should never be committed
4. Run 'git reset HEAD <file>' to unstage problematic files

This check prevents credential exposure like Issue #2142 and #12524.
"""
                print(error_message, file=sys.stderr)
                sys.exit(2)  # Block the commit
            else:
                debug_log(f"{tool_used} scan passed - no secrets detected")

    else:
        # No security tools installed - show warning (once per session)
        if not warning_already_shown(session_id):
            mark_warning_shown(session_id)

            warning_message = """
💡 Security Tip: No secret scanning tool detected.

Claude Code is about to commit files on your behalf. For automatic
credential detection, consider installing TruffleHog or GitLeaks:

  # TruffleHog (recommended)
  brew install trufflehog          # macOS
  pip install trufflehog           # Python

  # GitLeaks
  brew install gitleaks            # macOS
  go install github.com/gitleaks/gitleaks/v8@latest  # Go

Once installed, Claude Code will automatically scan commits for secrets.

Learn more:
  - TruffleHog: https://github.com/trufflesecurity/trufflehog
  - GitLeaks: https://github.com/gitleaks/gitleaks

Related: Issues #2142, #12524 (credential exposure incidents)
"""
            print(warning_message, file=sys.stderr)
            # Don't block - just warn

    # Allow commit to proceed
    sys.exit(0)


if __name__ == "__main__":
    main()
