#!/usr/bin/env python3
"""
Push Guardrails Hook for Claude Code

Prevents accidental exposure of private code to public repositories by:
1. Checking repository visibility before git push / gh pr create
2. Detecting sensitive files (credentials, keys, etc.) before git commit
3. Warning about fork visibility (forks of public repos are always public)

Addresses: https://github.com/anthropics/claude-code/issues/29225
"""

import fcntl
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime

# Debug log file (user-specific to avoid conflicts in multi-user environments)
DEBUG_LOG_FILE = os.path.join(
    os.path.expanduser("~"), ".claude", "push-guardrails-debug.log"
)


def debug_log(message):
    """Append debug message to log file with timestamp."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


# --- Command detection patterns ---

# Optional prefix: env vars (FOO=bar), `env`, `command`, `builtin`
_CMD_PREFIX = r"(?:(?:\w+=\S*\s+)*(?:env\s+|command\s+|builtin\s+)*)"
# Optional git global options like -C /path, -c key=val, --git-dir=...
_GIT_OPTS = r"(?:\s+(?:-[Cc]\s+\S+|--git-dir[=\s]\S+|--work-tree[=\s]\S+))*"

# Commands that push code to remote (need repo visibility check)
PUSH_PATTERNS = [
    re.compile(_CMD_PREFIX + r"\bgit" + _GIT_OPTS + r"\s+push\b"),
    re.compile(_CMD_PREFIX + r"\bgh\s+pr\s+create\b"),
]

# Commands that stage/commit code (need sensitive file check)
COMMIT_PATTERNS = [
    re.compile(_CMD_PREFIX + r"\bgit" + _GIT_OPTS + r"\s+commit\b"),
]

# Broad git add patterns (git add . / git add -A / git add --all)
ADD_BROAD_PATTERNS = [
    re.compile(_CMD_PREFIX + r"\bgit" + _GIT_OPTS + r"\s+add\s+(-A|--all|\.)(\s|$|&|;|\|)"),
]

# Quick skip: commands that are definitely not git-related
# Only matches when the very first token is a known non-git command
SKIP_PATTERN = re.compile(
    r"^\s*(?:\w+=\S*\s+)*"
    r"(ls|pwd|echo|cat|head|tail|grep|rg|find|mkdir|cd|npm|npx|pip|python|"
    r"python3|node|cargo|make|curl|wget|which|type|touch|cp|mv|rm|chmod|chown|"
    r"date|whoami|hostname|uname|df|du|ps|kill|top|htop|brew|apt|yum|dnf)\b"
)

# --- Sensitive file patterns ---

SENSITIVE_FILE_PATTERNS = [
    # Credentials and secrets
    re.compile(r"\.env$"),
    re.compile(r"\.env\.[a-zA-Z]+$"),
    re.compile(r"credentials", re.IGNORECASE),
    re.compile(r"secrets?\.", re.IGNORECASE),
    re.compile(r"\.pem$"),
    re.compile(r"\.key$"),
    re.compile(r"\.p12$"),
    re.compile(r"\.pfx$"),
    re.compile(r"\.jks$"),
    re.compile(r"id_rsa"),
    re.compile(r"id_ed25519"),
    re.compile(r"id_ecdsa"),
    re.compile(r"\.keystore$"),
    # API and token files
    re.compile(r"api[_-]?key", re.IGNORECASE),
    re.compile(r"token\.(json|txt|ya?ml|cfg|ini|xml)$", re.IGNORECASE),
    re.compile(r"auth[_-]?token", re.IGNORECASE),
    re.compile(r"\.npmrc$"),
    re.compile(r"\.pypirc$"),
    re.compile(r"\.netrc$"),
    re.compile(r"\.htpasswd$"),
    # Cloud provider configs
    re.compile(r"\.aws/"),
    re.compile(r"gcloud.*\.json$"),
    re.compile(r"kubeconfig"),
    re.compile(r"terraform\.tfvars$"),
    # Database and application config
    re.compile(r"database\.yml$"),
    re.compile(r"wp-config\.php$"),
]


# --- Session state management ---


def get_state_file(session_id):
    """Get session-specific state file path."""
    return os.path.expanduser(
        f"~/.claude/push_guardrails_state_{session_id}.json"
    )


def cleanup_old_state_files():
    """Remove state files older than 7 days. Runs at most once per day."""
    try:
        state_dir = os.path.expanduser("~/.claude")
        if not os.path.exists(state_dir):
            return

        # Check if cleanup ran recently (within the last 24 hours)
        marker = os.path.join(state_dir, ".push_guardrails_last_cleanup")
        if os.path.exists(marker):
            last_cleanup = os.path.getmtime(marker)
            if datetime.now().timestamp() - last_cleanup < 86400:
                return

        current_time = datetime.now().timestamp()
        seven_days_ago = current_time - (7 * 24 * 60 * 60)
        for filename in os.listdir(state_dir):
            if filename.startswith("push_guardrails_state_") and filename.endswith(
                ".json"
            ):
                file_path = os.path.join(state_dir, filename)
                try:
                    if os.path.getmtime(file_path) < seven_days_ago:
                        os.remove(file_path)
                except (OSError, IOError):
                    pass

        # Update marker
        with open(marker, "w") as f:
            f.write("")
    except Exception:
        pass


def load_state(session_id):
    """Load the set of already-shown warnings for this session."""
    state_file = get_state_file(session_id)
    if os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                fcntl.flock(f, fcntl.LOCK_SH)
                try:
                    return set(json.load(f))
                finally:
                    fcntl.flock(f, fcntl.LOCK_UN)
        except (json.JSONDecodeError, IOError):
            return set()
    return set()


def save_state(session_id, shown_warnings):
    """Save the set of shown warnings."""
    state_file = get_state_file(session_id)
    try:
        os.makedirs(os.path.dirname(state_file), exist_ok=True)
        with open(state_file, "w") as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            try:
                json.dump(list(shown_warnings), f)
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)
    except IOError as e:
        debug_log(f"Failed to save state file: {e}")


# --- Helper functions ---


def get_repo_info():
    """Get repository visibility info via gh API.

    Returns:
        Tuple of (repo_full_name, visibility, is_fork, parent_visibility)
        or None on failure.
    """
    try:
        result = subprocess.run(
            [
                "gh",
                "api",
                "repos/{owner}/{repo}",
                "--jq",
                "[.full_name, .visibility, .fork, .parent.visibility] | @tsv",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            debug_log(f"gh api failed: {result.stderr}")
            return None

        parts = result.stdout.strip().split("\t")
        if len(parts) < 3:
            debug_log(f"Unexpected gh api output: {result.stdout}")
            return None

        repo_name = parts[0]
        visibility = parts[1]  # "public" or "private"
        is_fork = parts[2].lower() == "true"
        parent_visibility = (
            parts[3] if len(parts) > 3 and parts[3] not in ("", "null") else None
        )

        return (repo_name, visibility, is_fork, parent_visibility)
    except FileNotFoundError:
        debug_log("gh CLI not found")
        return None
    except subprocess.TimeoutExpired:
        debug_log("gh api timed out")
        return None
    except Exception as e:
        debug_log(f"get_repo_info error: {e}")
        return None


def get_unpushed_files():
    """Get list of files in unpushed commits.

    Returns:
        List of file paths, or empty list on failure.
    """
    try:
        # Try upstream tracking branch first
        result = subprocess.run(
            [
                "git",
                "log",
                "--name-only",
                "--pretty=format:",
                "@{upstream}..HEAD",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            # Try common default branches
            for default_branch in ["origin/main", "origin/master"]:
                result = subprocess.run(
                    [
                        "git",
                        "log",
                        "--name-only",
                        "--pretty=format:",
                        f"{default_branch}..HEAD",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                if result.returncode == 0:
                    break
            else:
                return []

        files = [f for f in result.stdout.strip().split("\n") if f.strip()]
        return list(set(files))
    except Exception as e:
        debug_log(f"get_unpushed_files error: {e}")
        return []


def get_staged_files():
    """Get list of currently staged files.

    Returns:
        List of staged file paths.
    """
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            return []
        return [f for f in result.stdout.strip().split("\n") if f.strip()]
    except Exception as e:
        debug_log(f"get_staged_files error: {e}")
        return []


def detect_sensitive_files(file_list):
    """Check a list of file paths against sensitive patterns.

    Returns:
        List of file paths that match sensitive patterns.
    """
    sensitive = []
    for filepath in file_list:
        for pattern in SENSITIVE_FILE_PATTERNS:
            if pattern.search(filepath):
                sensitive.append(filepath)
                break
    return sensitive


# --- Command handlers ---


def handle_push_command(command, session_id):
    """Handle git push / gh pr create commands.

    Checks repository visibility and warns if pushing to a public repo.
    """
    repo_info = get_repo_info()
    if repo_info is None:
        # Could not determine repo info -- warn but allow
        print(
            "[push-guardrails] Could not verify repository visibility. "
            "Ensure `gh` CLI is installed and authenticated (`gh auth login`).",
            file=sys.stderr,
        )
        sys.exit(0)

    repo_name, visibility, is_fork, parent_visibility = repo_info

    # Private non-fork repos need no checks
    if visibility != "public" and not is_fork:
        sys.exit(0)

    # Get files early so we can include them in the dedup key
    files_to_push = get_unpushed_files()
    files_hash = hashlib.sha256(
        ",".join(sorted(files_to_push)).encode()
    ).hexdigest()[:12]

    # Session-based dedup (includes file hash so new files trigger re-warning)
    warning_key = f"push-{repo_name}-{files_hash}"
    shown_warnings = load_state(session_id)
    if warning_key in shown_warnings:
        sys.exit(0)

    warnings = []

    # Check 1: Public repo
    if visibility == "public":
        warnings.append(
            "PUBLIC REPOSITORY DETECTED\n"
            f"  Repository '{repo_name}' is PUBLIC.\n"
            "  Any code pushed will be visible to everyone on the internet.\n"
            "  Please verify that no proprietary code, trade secrets, API keys,\n"
            "  or credentials are included."
        )

    # Check 2: Fork of a public repo
    if is_fork and parent_visibility == "public":
        warnings.append(
            "PUBLIC FORK DETECTED\n"
            f"  This repository is a fork of a PUBLIC repository.\n"
            "  Forks of public repos are always public on GitHub.\n"
            "  Any code pushed here will be publicly visible."
        )
    elif is_fork and visibility == "public":
        warnings.append(
            "FORK VISIBILITY WARNING\n"
            "  This is a fork and it is public.\n"
            "  Ensure you intend to expose this code publicly."
        )

    # Check 3: List files that will be exposed
    if warnings and files_to_push:
        sensitive_files = detect_sensitive_files(files_to_push)

        file_summary = "\n".join(f"    - {f}" for f in files_to_push[:20])
        if len(files_to_push) > 20:
            file_summary += f"\n    ... and {len(files_to_push) - 20} more files"

        warnings.append(
            f"FILES TO BE PUSHED ({len(files_to_push)} files):\n{file_summary}"
        )

        if sensitive_files:
            sensitive_summary = "\n".join(
                f"    - {f}" for f in sensitive_files
            )
            warnings.append(
                "SENSITIVE FILES DETECTED in push:\n" + sensitive_summary
            )

    if warnings:
        shown_warnings.add(warning_key)
        save_state(session_id, shown_warnings)

        header = "push-guardrails: Push to public repository detected"
        separator = "=" * len(header)
        message = f"\n{separator}\n{header}\n{separator}\n\n"
        message += "\n\n".join(f"WARNING: {w}" for w in warnings)
        message += (
            "\n\n"
            "To proceed, acknowledge the warnings and re-run the push command.\n"
            "To disable this check, set PUSH_GUARDRAILS_DISABLED=1."
        )

        print(message, file=sys.stderr)
        sys.exit(2)  # Block

    sys.exit(0)


def handle_commit_command(command, session_id):
    """Handle git commit commands.

    Checks staged files for sensitive patterns.
    """
    staged_files = get_staged_files()
    if not staged_files:
        sys.exit(0)

    sensitive_files = detect_sensitive_files(staged_files)
    if not sensitive_files:
        sys.exit(0)

    # Session dedup by sensitive file set
    warning_key = "commit-" + ",".join(sorted(sensitive_files))
    shown_warnings = load_state(session_id)
    if warning_key in shown_warnings:
        sys.exit(0)

    shown_warnings.add(warning_key)
    save_state(session_id, shown_warnings)

    sensitive_summary = "\n".join(f"  - {f}" for f in sensitive_files)
    message = (
        "\n"
        "======================================================\n"
        "push-guardrails: Sensitive files detected in staged changes\n"
        "======================================================\n"
        "\n"
        f"WARNING: The following staged files may contain credentials,\n"
        f"API keys, or proprietary code:\n\n"
        f"{sensitive_summary}\n\n"
        "Please verify these files should be committed.\n"
        "Consider adding them to .gitignore if they contain secrets.\n"
        "To disable this check, set PUSH_GUARDRAILS_DISABLED=1."
    )

    print(message, file=sys.stderr)
    sys.exit(2)  # Block


def handle_add_broad_command(command, session_id):
    """Handle broad git add commands (git add . / git add -A).

    Warns about staging all files which may include sensitive files.
    """
    # Check what would be staged
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            sys.exit(0)

        # Parse untracked and modified files
        files = []
        for line in result.stdout.strip().split("\n"):
            if line.strip():
                # Status is first 2 chars, filename starts at position 3
                filepath = line[3:].strip()
                # Handle renames: "old -> new"
                if " -> " in filepath:
                    filepath = filepath.split(" -> ")[-1]
                files.append(filepath)

        sensitive_files = detect_sensitive_files(files)
        if not sensitive_files:
            sys.exit(0)

        warning_key = "add-broad-" + ",".join(sorted(sensitive_files))
        shown_warnings = load_state(session_id)
        if warning_key in shown_warnings:
            sys.exit(0)

        shown_warnings.add(warning_key)
        save_state(session_id, shown_warnings)

        sensitive_summary = "\n".join(f"  - {f}" for f in sensitive_files)
        message = (
            "\n"
            "======================================================\n"
            "push-guardrails: Sensitive files would be staged\n"
            "======================================================\n"
            "\n"
            f"WARNING: Broad `git add` detected. The following files may\n"
            f"contain credentials or sensitive data:\n\n"
            f"{sensitive_summary}\n\n"
            "Consider staging files individually instead.\n"
            "To disable this check, set PUSH_GUARDRAILS_DISABLED=1."
        )

        print(message, file=sys.stderr)
        sys.exit(2)

    except Exception as e:
        debug_log(f"handle_add_broad error: {e}")
        sys.exit(0)


# --- Main ---


def main():
    """Main hook function."""
    # Check if guardrails are disabled
    if os.environ.get("PUSH_GUARDRAILS_DISABLED", "0") == "1":
        sys.exit(0)

    # Clean up old state files (runs at most once per day)
    cleanup_old_state_files()

    # Read input from stdin
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except json.JSONDecodeError as e:
        debug_log(f"JSON decode error: {e}")
        sys.exit(0)

    # Quick exit if not a Bash tool
    if input_data.get("tool_name") != "Bash":
        sys.exit(0)

    command = input_data.get("tool_input", {}).get("command", "")
    if not command:
        sys.exit(0)

    # Fast-path skip for non-git commands
    if SKIP_PATTERN.match(command):
        sys.exit(0)

    session_id = input_data.get("session_id", "default")

    # Route to appropriate handler (push takes priority)
    for pattern in PUSH_PATTERNS:
        if pattern.search(command):
            handle_push_command(command, session_id)
            return

    for pattern in ADD_BROAD_PATTERNS:
        if pattern.search(command):
            handle_add_broad_command(command, session_id)
            return

    for pattern in COMMIT_PATTERNS:
        if pattern.search(command):
            handle_commit_command(command, session_id)
            return

    # Not a relevant command
    sys.exit(0)


if __name__ == "__main__":
    main()
