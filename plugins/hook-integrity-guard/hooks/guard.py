#!/usr/bin/env python3
"""
hook-integrity-guard: prevents Claude from modifying its own hooks, settings,
and safety infrastructure.

addresses:
  - https://github.com/anthropics/claude-code/issues/32376
    (Claude rewrites its own hooks to weaken enforcement)
  - https://github.com/anthropics/claude-code/issues/32990
    (Claude deletes hook scripts, hooks fail open silently)
  - CVE-2025-59536 (severity 8.7/10)

guards against all four write vectors:
  - Edit: targeted file_path check
  - Write: targeted file_path check
  - MultiEdit: targeted file_path check
  - Bash: command pattern analysis for rm, mv, chmod, sed, tee, redirects, etc.
"""

import json
import os
import re
import sys

# ──────────────────────────────────────────────────────────────────────────────
# protected paths
# ──────────────────────────────────────────────────────────────────────────────

HOME = os.path.expanduser("~")

# directories where hook scripts and settings live
PROTECTED_DIRS = [
    os.path.join(HOME, ".claude", "hooks"),
    os.path.join(HOME, ".claude", "commands"),
]

# individual files that control hook/safety behavior
PROTECTED_FILES = [
    os.path.join(HOME, ".claude", "settings.json"),
    os.path.join(HOME, ".claude", "settings.local.json"),
]

# patterns for plugin hook files (relative to any plugin root)
PROTECTED_PATTERNS = [
    "hooks.json",
    os.path.join("hooks", ""),       # any file inside a hooks/ directory
    os.path.join(".claude-plugin", "plugin.json"),
]


def normalize_path(path: str) -> str:
    """resolve ~, $HOME, env vars, .., and symlinks to a canonical path."""
    if not path:
        return ""
    # expand $HOME, ~, and other env vars
    path = os.path.expandvars(path)
    path = os.path.expanduser(path)
    # resolve .. and symlinks
    try:
        path = os.path.realpath(path)
    except (OSError, ValueError):
        path = os.path.abspath(path)
    return path


def is_protected_path(file_path: str) -> str | None:
    """
    check if a file path targets a protected location.
    returns a human-readable reason if protected, None otherwise.
    """
    resolved = normalize_path(file_path)
    if not resolved:
        return None

    # check exact protected files
    for protected in PROTECTED_FILES:
        if resolved == os.path.realpath(protected):
            return f"settings file ({os.path.basename(protected)})"

    # check protected directories
    for protected_dir in PROTECTED_DIRS:
        real_dir = os.path.realpath(protected_dir)
        if resolved.startswith(real_dir + os.sep) or resolved == real_dir:
            return f"hook directory ({os.path.basename(protected_dir)}/)"

    # check plugin hook patterns (catches hooks.json and hooks/ in any plugin)
    for pattern in PROTECTED_PATTERNS:
        if pattern.endswith(os.sep):
            # directory pattern: check if path contains /hooks/ segment
            if os.sep + pattern in resolved + os.sep:
                return f"plugin hook directory ({pattern})"
        else:
            if resolved.endswith(os.sep + pattern) or os.sep + pattern + os.sep in resolved:
                return f"plugin config ({pattern})"

    return None


# ──────────────────────────────────────────────────────────────────────────────
# bash command analysis
# ──────────────────────────────────────────────────────────────────────────────

# commands that modify or destroy files
DESTRUCTIVE_COMMANDS = re.compile(
    r"\b(?:rm|rmdir|unlink|mv|cp|chmod|chown|chflags|truncate)\b"
)

# in-place file editors
INPLACE_EDITORS = re.compile(
    r"\b(?:sed\s+-i|perl\s+-[ip]|awk\s+-i)\b"
)

# output redirection targeting a file
REDIRECT_PATTERN = re.compile(
    r"(?:>\s*|>>\s*|tee\s+(?:-a\s+)?)"
)

# common path fragments that indicate hook/settings targets
SENSITIVE_PATH_FRAGMENTS = [
    ".claude/hooks",
    ".claude/settings",
    ".claude/commands",
    "hooks.json",
    "hooks/guard",
    "hooks/hooks.json",
    ".claude-plugin/plugin.json",
]


def check_bash_command(command: str) -> str | None:
    """
    analyze a bash command for operations that could modify protected files.
    returns a reason string if the command targets protected paths, None otherwise.
    """
    if not command:
        return None

    # normalize the command for analysis
    cmd_lower = command.lower()

    # check if the command references any sensitive path fragments
    targeted_paths = []
    for fragment in SENSITIVE_PATH_FRAGMENTS:
        if fragment.lower() in cmd_lower:
            targeted_paths.append(fragment)

    if not targeted_paths:
        return None

    # the command references sensitive paths, now check if it's destructive
    is_destructive = bool(DESTRUCTIVE_COMMANDS.search(command))
    is_inplace_edit = bool(INPLACE_EDITORS.search(command))
    is_redirect = bool(REDIRECT_PATTERN.search(command))

    # also catch: cat > file, echo > file, printf > file
    has_write_redirect = bool(re.search(r"(?:cat|echo|printf)\s+.*>", command))

    if is_destructive or is_inplace_edit or is_redirect or has_write_redirect:
        paths_str = ", ".join(targeted_paths)
        if is_destructive:
            return f"destructive command targeting: {paths_str}"
        elif is_inplace_edit:
            return f"in-place edit targeting: {paths_str}"
        else:
            return f"write/redirect targeting: {paths_str}"

    return None


# ──────────────────────────────────────────────────────────────────────────────
# main hook logic
# ──────────────────────────────────────────────────────────────────────────────

DENY_PREFIX = "[hook-integrity-guard]"


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
    except (json.JSONDecodeError, Exception):
        # fail open on malformed input to avoid breaking unrelated operations
        sys.exit(0)

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})

    reason = None

    if tool_name in ("Edit", "Write", "MultiEdit"):
        file_path = tool_input.get("file_path", "")
        reason = is_protected_path(file_path)

        # MultiEdit has an edits array, but file_path is still top-level
        # no additional check needed since all edits target the same file

    elif tool_name == "Bash":
        command = tool_input.get("command", "")
        reason = check_bash_command(command)

    if reason:
        msg = (
            f"{DENY_PREFIX} blocked: {reason}\n"
            f"\n"
            f"Claude is not allowed to modify its own hooks, settings, or safety\n"
            f"infrastructure. This restriction exists because the model has been\n"
            f"observed weakening its own constraints to complete tasks more easily\n"
            f"(see CVE-2025-59536, anthropics/claude-code#32376, #32990).\n"
            f"\n"
            f"If you need to modify these files, do so manually outside of Claude."
        )
        print(msg, file=sys.stderr)
        sys.exit(2)

    # allow the operation
    sys.exit(0)


if __name__ == "__main__":
    main()
