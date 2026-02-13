#!/usr/bin/env python3
"""
Destructive Command Guard Hook for Claude Code

PreToolUse hook that:
- BLOCKS dangerous Bash commands (mass deletion, Docker mass ops, destructive git,
  indirect execution, alternative deletion tools, file modification via Bash)
- WARNS about edits to policy files (CLAUDE.md, .claude/settings.json, hooks.json)

Exit codes:
  0 - allow (or warn via JSON on stdout)
  2 - block (message on stderr)

Security model:
  Blocklist approach -- first line of defense against accidental destructive commands.
  Not a sandbox. Cannot prevent all obfuscation vectors, but catches common patterns.
"""

import json
import os
import random
import re
import sys
import tempfile
from datetime import datetime


# --- Configuration ---

STATE_FILE_PREFIX = "destructive_guard_state_"
# Log in user directory, not /tmp (prevents symlink attacks, CWE-377)
CLAUDE_DIR = os.path.expanduser("~/.claude")
DEBUG_LOG_FILE = os.path.join(CLAUDE_DIR, "destructive-guard-log.txt")


def debug_log(message):
    """Write a debug log entry with timestamp to user directory."""
    try:
        os.makedirs(CLAUDE_DIR, mode=0o700, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


# --- Session state ---


def _sanitize_session_id(session_id):
    """Validate session_id to prevent path traversal (CWE-22)."""
    if not session_id or not re.match(r"^[a-zA-Z0-9_.-]+$", session_id):
        return "default_safe"
    return session_id


def get_state_file(session_id):
    """Return path to session state file (with sanitization)."""
    safe_id = _sanitize_session_id(session_id)
    return os.path.join(CLAUDE_DIR, f"{STATE_FILE_PREFIX}{safe_id}.json")


def cleanup_old_state_files():
    """Remove state files older than 30 days."""
    try:
        if not os.path.exists(CLAUDE_DIR):
            return
        current_time = datetime.now().timestamp()
        thirty_days_ago = current_time - (30 * 24 * 60 * 60)
        for filename in os.listdir(CLAUDE_DIR):
            if filename.startswith(STATE_FILE_PREFIX) and filename.endswith(".json"):
                file_path = os.path.join(CLAUDE_DIR, filename)
                try:
                    if os.path.getmtime(file_path) < thirty_days_ago:
                        os.remove(file_path)
                except (OSError, IOError):
                    pass
    except Exception:
        pass


def load_state(session_id):
    """Load the set of already shown warnings."""
    state_file = get_state_file(session_id)
    if os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                return set(json.load(f))
        except (json.JSONDecodeError, IOError):
            return set()
    return set()


def save_state(session_id, shown_warnings):
    """Atomic state save (tempfile + os.replace, POSIX atomic)."""
    state_file = get_state_file(session_id)
    try:
        os.makedirs(os.path.dirname(state_file), mode=0o700, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(
            dir=os.path.dirname(state_file), suffix=".tmp", text=True
        )
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(list(shown_warnings), f)
            os.replace(tmp_path, state_file)
        except Exception:
            # Clean up temporary file on error
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except IOError:
        pass


# --- Bash command parsers ---


def _split_commands(command):
    """Split command into parts by &&, ||, ;, |, and newlines (simplified split).

    Does not handle nested quotes -- this is a limitation of the blocklist approach.
    """
    parts = re.split(r"\s*(?:&&|\|\||;|\|)\s*|[\r\n]+", command)
    return [p.strip() for p in parts if p.strip()]


def _normalize_path(path):
    """Path normalization -- catches variants like /./  //  /../.. etc."""
    cleaned = path
    # Remove double slashes
    while "//" in cleaned:
        cleaned = cleaned.replace("//", "/")
    # Remove /./ sequences
    while "/./" in cleaned:
        cleaned = cleaned.replace("/./", "/")
    # If it contains parent traversal (..) -- suspicious
    if "/.." in cleaned or cleaned.startswith(".."):
        return "/"
    return cleaned.rstrip("/") or "/"


def _parse_rm_flags_and_targets(args_str):
    """Parse flags and targets from rm arguments.

    Handles: -rf, -r -f, -rfv, --recursive --force, etc.
    Returns (flags: set, targets: list).
    """
    tokens = args_str.split()
    flags = set()
    targets = []
    end_of_flags = False
    for i, token in enumerate(tokens):
        if end_of_flags:
            targets.append(token)
            continue
        if token == "--":
            end_of_flags = True
            continue
        if token.startswith("--"):
            flag_name = token.lstrip("-")
            if flag_name == "recursive":
                flags.add("r")
            elif flag_name == "force":
                flags.add("f")
            else:
                flags.add(flag_name)
        elif token.startswith("-") and not token.startswith("--"):
            for char in token[1:]:
                flags.add(char)
        else:
            targets.append(token)
    return flags, targets


# Dangerous paths for rm -rf
_DANGEROUS_RM_TARGETS = {
    "/", "/*",
    "~", "~/", "~/*",
    "$HOME", "$HOME/", "$HOME/*",
    "${HOME}", "${HOME}/", "${HOME}/*",
    ".", "./", "./*",
    "..", "../", "../*",
    "*",
}

# System paths -- also dangerous for rm -rf
_DANGEROUS_SYSTEM_PATHS = {
    "/etc", "/usr", "/var", "/home", "/opt", "/boot",
    "/bin", "/sbin", "/lib", "/lib64", "/srv", "/root",
    "/System", "/Applications", "/Library", "/Users",
}


def check_rm_dangerous(command):
    """Check if the rm command is dangerous.

    Blocks: rm -rf /, ~, ., .., *, /etc, /usr, /var, /home, variables, subshells
    Allows: rm -rf node_modules, rm -rf /tmp/build, rm file.txt
    """
    for part in _split_commands(command):
        tokens = part.split()
        if not tokens or tokens[0] != "rm":
            continue
        args_str = " ".join(tokens[1:])
        flags, targets = _parse_rm_flags_and_targets(args_str)

        has_recursive = "r" in flags or "R" in flags
        has_force = "f" in flags
        if not (has_recursive and has_force):
            continue

        # Check backticks in entire args_str (split breaks them into multiple tokens)
        if "`" in args_str:
            return (
                "BLOCKED: 'rm -rf' with backtick command substitution is not allowed. "
                "Specify the target path directly so it can be validated."
            )

        for target in targets:
            # Check command substitution / variable expansion
            if re.search(r"\$\(.*\)|`.*`", target):
                return (
                    "BLOCKED: 'rm -rf' with command substitution is not allowed. "
                    "Specify the target path directly so it can be validated."
                )
            if re.search(r"\$\{?\w+\}?", target) and target not in _DANGEROUS_RM_TARGETS:
                # Variable not on the known list -- suspicious
                return (
                    f"BLOCKED: 'rm -rf' with variable expansion ({target}) is not allowed. "
                    "Specify the target path directly so it can be validated."
                )

            # Path normalization
            normalized = _normalize_path(target)
            raw_stripped = target.rstrip("/") or "/"

            # Check literal dangerous targets
            if (target in _DANGEROUS_RM_TARGETS
                    or raw_stripped in _DANGEROUS_RM_TARGETS
                    or normalized in _DANGEROUS_RM_TARGETS):
                return (
                    f"BLOCKED: 'rm -rf {target}' would cause irreversible data loss. "
                    f"This command targets a critical path ({target}). "
                    "If you need to remove specific files, use a more targeted command."
                )

            # Check system paths
            if normalized in _DANGEROUS_SYSTEM_PATHS or raw_stripped in _DANGEROUS_SYSTEM_PATHS:
                return (
                    f"BLOCKED: 'rm -rf {target}' targets a critical system directory. "
                    "Removing system directories causes irreversible damage."
                )
            # Check if target with /* is a system path
            if target.endswith("/*"):
                base = target[:-2].rstrip("/") or "/"
                if base in _DANGEROUS_SYSTEM_PATHS:
                    return (
                        f"BLOCKED: 'rm -rf {target}' targets contents of a critical system directory."
                    )

    return None


# --- Indirect execution / obfuscation ---


def check_indirect_execution(command):
    """Block indirect command execution (eval, sh -c, pipe to shell, base64).

    Prevents bypassing the guard by wrapping commands in eval/sh/bash.
    """
    for part in _split_commands(command):
        tokens = part.split()
        if not tokens:
            continue

        cmd = tokens[0]

        # eval with arguments
        if cmd == "eval" and len(tokens) > 1:
            return (
                "BLOCKED: 'eval' executes arbitrary strings as commands, bypassing safety checks. "
                "Run the command directly instead."
            )

        # sh -c / bash -c / zsh -c
        if cmd in ("sh", "bash", "zsh") and "-c" in tokens:
            return (
                f"BLOCKED: '{cmd} -c' executes arbitrary strings as commands, "
                "bypassing safety checks. Run the command directly instead."
            )

    # Pipe to shell: ... | sh, ... | bash, ... | zsh
    if re.search(r"\|\s*(?:sh|bash|zsh)\s*$", command):
        return (
            "BLOCKED: Piping output to a shell interpreter bypasses safety checks. "
            "Run the command directly instead."
        )

    # base64 decode piped to shell
    if re.search(r"base64\s+.*\|\s*(?:sh|bash|zsh)", command):
        return (
            "BLOCKED: Decoding and piping to shell is a common obfuscation technique. "
            "Run the command directly instead."
        )

    return None


# --- Alternative deletion tools ---


def check_alternative_deletion(command):
    """Block alternative deletion tools on dangerous paths.

    Blocks: find / -delete, find ~ -delete, find / -exec rm, xargs rm on dangerous paths
    Allows: find ./src -name '*.pyc' -delete (specific path)
    """
    for part in _split_commands(command):
        tokens = part.split()
        if not tokens or tokens[0] != "find" or len(tokens) < 2:
            continue

        target = tokens[1]
        normalized = _normalize_path(target)
        all_dangerous = _DANGEROUS_RM_TARGETS | _DANGEROUS_SYSTEM_PATHS | {
            "$HOME", "${HOME}", "~"
        }
        is_dangerous_path = normalized in all_dangerous or target in all_dangerous

        if not is_dangerous_path:
            continue

        # find <dangerous_path> ... -delete
        if "-delete" in tokens:
            return (
                f"BLOCKED: 'find {target} -delete' would cause irreversible data loss. "
                "Use a more specific path."
            )

        # find <dangerous_path> ... -exec rm / -execdir rm
        if "-exec" in tokens or "-execdir" in tokens:
            rest = " ".join(tokens)
            if re.search(r"-exec(?:dir)?\s+rm\b", rest):
                return (
                    f"BLOCKED: 'find {target} -exec rm' would cause irreversible data loss. "
                    "Use a more specific path."
                )

    # xargs rm on dangerous paths (e.g., find / | xargs rm -rf)
    if re.search(r"xargs\s+rm\b", command):
        for part in _split_commands(command):
            tokens = part.split()
            if tokens and tokens[0] == "find" and len(tokens) >= 2:
                target = tokens[1]
                normalized = _normalize_path(target)
                all_dangerous = _DANGEROUS_RM_TARGETS | _DANGEROUS_SYSTEM_PATHS
                if normalized in all_dangerous or target in all_dangerous:
                    return (
                        f"BLOCKED: 'find {target} | xargs rm' would cause irreversible data loss. "
                        "Use a more specific path."
                    )

    return None


# --- Docker ---


_DOCKER_DANGEROUS_PATTERNS = [
    # docker rm/stop/kill with subshell $(docker ps ...)
    (
        r"docker\s+(?:rm|stop|kill)\s+.*\$\(docker\s+ps",
        "BLOCKED: Mass Docker container removal/stop/kill via subshell. "
        "Remove containers individually by name instead.",
    ),
    # docker rm/stop/kill with backticks `docker ps ...`
    (
        r"docker\s+(?:rm|stop|kill)\s+.*`docker\s+ps",
        "BLOCKED: Mass Docker container removal/stop/kill via subshell. "
        "Remove containers individually by name instead.",
    ),
    # docker system prune
    (
        r"docker\s+system\s+prune",
        "BLOCKED: 'docker system prune' removes all unused data (containers, images, networks). "
        "Use targeted cleanup commands instead.",
    ),
    # docker volume prune
    (
        r"docker\s+volume\s+prune",
        "BLOCKED: 'docker volume prune' removes all unused volumes and their data. "
        "Remove specific volumes by name instead.",
    ),
    # docker container prune
    (
        r"docker\s+container\s+prune",
        "BLOCKED: 'docker container prune' removes all stopped containers. "
        "Remove specific containers by name instead.",
    ),
    # docker image prune -a (removes ALL unused images)
    (
        r"docker\s+image\s+prune\s+(?:.*\s)?-a",
        "BLOCKED: 'docker image prune -a' removes all unused images. "
        "Remove specific images by name/tag instead.",
    ),
    (
        r"docker\s+image\s+prune\s+(?:.*\s)?--all",
        "BLOCKED: 'docker image prune --all' removes all unused images. "
        "Remove specific images by name/tag instead.",
    ),
    # docker network prune
    (
        r"docker\s+network\s+prune",
        "BLOCKED: 'docker network prune' removes all unused networks. "
        "Remove specific networks by name instead.",
    ),
    # docker builder prune
    (
        r"docker\s+builder\s+prune",
        "BLOCKED: 'docker builder prune' removes all build cache. "
        "Use targeted cleanup instead.",
    ),
    # docker volume rm with mass subshell $(docker volume ls ...)
    (
        r"docker\s+volume\s+rm\s+.*\$\(docker\s+volume\s+ls",
        "BLOCKED: Mass Docker volume removal via subshell. "
        "Remove volumes individually by name instead.",
    ),
    # docker volume rm with backticks `docker volume ls ...`
    (
        r"docker\s+volume\s+rm\s+.*`docker\s+volume\s+ls",
        "BLOCKED: Mass Docker volume removal via subshell. "
        "Remove volumes individually by name instead.",
    ),
    # docker compose down -v / --volumes
    (
        r"docker[\s-]compose\s+down\s+(?:.*\s)?-v\b",
        "BLOCKED: 'docker compose down -v' removes all associated volumes. "
        "Use 'docker compose down' without -v to preserve volume data.",
    ),
    (
        r"docker[\s-]compose\s+down\s+(?:.*\s)?--volumes\b",
        "BLOCKED: 'docker compose down --volumes' removes all associated volumes. "
        "Use 'docker compose down' without --volumes to preserve volume data.",
    ),
]


def check_docker_dangerous(command):
    """Check if the docker command is dangerous.

    Blocks: docker system/volume/container/network/builder prune,
            docker rm/stop/kill with subshell, docker compose down -v
    Allows: docker rm my-container, docker stop my-container,
            docker image prune (without -a)
    """
    for part in _split_commands(command):
        for pattern, message in _DOCKER_DANGEROUS_PATTERNS:
            if re.search(pattern, part):
                return message
    return None


# --- Git ---


def check_git_dangerous(command):
    """Check if the git command is dangerous.

    Blocks: git clean -fd/-fx/-fdx (without dry-run), git checkout -- .,
            git reset --hard (without target), git push --force,
            git branch -D, git stash clear
    Allows: git clean -n, git reset --hard abc1234, git push,
            git branch -d, git stash
    """
    for part in _split_commands(command):
        tokens = part.split()
        if not tokens or tokens[0] != "git":
            continue
        if len(tokens) < 2:
            continue

        subcommand = tokens[1]

        # git clean (without dry-run, with force + dirs/ignored)
        if subcommand == "clean":
            args_str = " ".join(tokens[2:])
            has_dry_run = bool(re.search(r"(?:^|\s)-[a-zA-Z]*n", args_str)) or \
                          "--dry-run" in args_str
            if has_dry_run:
                continue
            all_short_flags = set()
            for token in tokens[2:]:
                if token.startswith("-") and not token.startswith("--"):
                    for char in token[1:]:
                        all_short_flags.add(char)
            has_force = "f" in all_short_flags
            has_dirs_or_ignored = "d" in all_short_flags or "x" in all_short_flags or \
                                  "X" in all_short_flags
            if has_force and has_dirs_or_ignored:
                return (
                    "BLOCKED: 'git clean -fdx' permanently deletes untracked files and directories. "
                    "Use 'git clean -ndx' (dry-run) first to preview what would be deleted."
                )

        # git checkout -- . / ./ / ./*
        if subcommand == "checkout":
            rest = " ".join(tokens[2:])
            if re.search(r"--\s+\.(?:[/\s*]|$)", rest):
                return (
                    "BLOCKED: 'git checkout -- .' discards all uncommitted changes. "
                    "Use 'git stash' to save changes, or checkout specific files."
                )

        # git reset --hard (without explicit target)
        if subcommand == "reset":
            rest_tokens = tokens[2:]
            if "--hard" in rest_tokens:
                non_flag_tokens = [
                    t for t in rest_tokens
                    if not t.startswith("-") and t != "--hard"
                ]
                if not non_flag_tokens:
                    return (
                        "BLOCKED: 'git reset --hard' without a target resets to HEAD, "
                        "discarding all uncommitted changes. "
                        "Specify an explicit commit (e.g., 'git reset --hard abc1234') "
                        "or use 'git stash' first."
                    )

        # git push --force / -f (overwrites remote history)
        if subcommand == "push":
            rest_tokens = tokens[2:]
            if "--force" in rest_tokens or "-f" in rest_tokens:
                return (
                    "BLOCKED: 'git push --force' overwrites remote history and can cause data loss "
                    "for other collaborators. Use 'git push --force-with-lease' for safer force push."
                )
            # Check combined flags e.g. -uf
            for token in rest_tokens:
                if token.startswith("-") and not token.startswith("--") and "f" in token[1:]:
                    return (
                        "BLOCKED: 'git push -f' overwrites remote history and can cause data loss "
                        "for other collaborators. Use 'git push --force-with-lease' instead."
                    )

        # git restore . / --staged . / --worktree . (discard uncommitted changes)
        if subcommand == "restore":
            rest_tokens = tokens[2:]
            # Collect all non-flag arguments (targets)
            targets = [t for t in rest_tokens if not t.startswith("-")]
            broad_targets = {".", "./", "./*", ":/"}
            has_broad_target = any(t in broad_targets for t in targets)
            if has_broad_target:
                has_staged = "--staged" in rest_tokens or "-S" in rest_tokens
                has_worktree = "--worktree" in rest_tokens or "-W" in rest_tokens
                if has_staged and has_worktree:
                    return (
                        "BLOCKED: 'git restore --staged --worktree .' discards all staged "
                        "and unstaged changes. Use 'git stash' to save changes, "
                        "or restore specific files."
                    )
                if has_staged:
                    return (
                        "BLOCKED: 'git restore --staged .' unstages all changes. "
                        "Use 'git restore --staged <file>' to unstage specific files."
                    )
                # Default: --worktree (or no flag, which implies --worktree)
                return (
                    "BLOCKED: 'git restore .' discards all uncommitted changes in the working tree. "
                    "Use 'git stash' to save changes, or restore specific files."
                )

        # git branch -D (force delete)
        if subcommand == "branch":
            rest_tokens = tokens[2:]
            if "-D" in rest_tokens:
                return (
                    "BLOCKED: 'git branch -D' force-deletes a branch even if not merged. "
                    "Use 'git branch -d' which will warn if the branch is not fully merged."
                )

        # git stash drop / clear (loss of saved changes)
        if subcommand == "stash":
            if len(tokens) >= 3:
                stash_action = tokens[2]
                if stash_action == "clear":
                    return (
                        "BLOCKED: 'git stash clear' permanently deletes all stashed changes. "
                        "Use 'git stash drop' to remove specific stash entries."
                    )
                if stash_action == "drop":
                    has_specific_ref = len(tokens) > 3
                    if not has_specific_ref:
                        return (
                            "BLOCKED: 'git stash drop' without a specific stash ref drops "
                            "the latest stash entry permanently. "
                            "Specify which stash to drop (e.g., 'git stash drop stash@{2}')."
                        )

    return None


# --- Configuration file protection ---
# Design decision: edits to protected files trigger a warning (exit 0 + systemMessage),
# but are NOT blocked (exit 2). The user may intentionally want to modify CLAUDE.md
# or settings -- blocking would hinder agent usage. The warning informs the agent
# about the file's sensitivity. Destructive Bash commands are blocked (exit 2)
# because they are irreversible.

# Names of protected files (for regex matching)
_PROTECTED_FILE_NAMES = [
    "CLAUDE.md",
    ".claude/settings.json",
    ".claude/settings.local.json",
    "hooks/hooks.json",
]

_PROTECTED_FILE_PATTERNS = [
    (
        r"(?:^|/)CLAUDE\.md$",
        "policy_file_claude_md",
        "You are about to modify CLAUDE.md, which defines agent behavior policies. "
        "Ensure this change is intentional and reviewed.",
    ),
    (
        r"(?:^|/)\.claude/settings\.json$",
        "settings_file",
        "You are about to modify .claude/settings.json, which controls agent permissions. "
        "Ensure this change is intentional and reviewed.",
    ),
    (
        r"(?:^|/)\.claude/settings\.local\.json$",
        "settings_local_file",
        "You are about to modify .claude/settings.local.json (local agent settings). "
        "Ensure this change is intentional and reviewed.",
    ),
    (
        r"(?:^|/)hooks/hooks\.json$",
        "hooks_config_file",
        "You are about to modify hooks/hooks.json, which configures plugin hooks. "
        "Ensure this change is intentional and reviewed.",
    ),
]


def check_file_protection(file_path):
    """Check if a file is protected (CLAUDE.md, settings, hooks.json).

    Returns (warning_key, message) or (None, None).
    """
    if not file_path:
        return None, None
    for pattern, key, message in _PROTECTED_FILE_PATTERNS:
        if re.search(pattern, file_path):
            return key, message
    return None, None


def check_bash_file_modification(command):
    """Check if a Bash command modifies protected files.

    Catches: echo > CLAUDE.md, sed -i CLAUDE.md, mv/cp/tee/truncate/dd
    Does not block -- returns a warning message string or None.
    """
    # File modification patterns in Bash
    _BASH_FILE_MOD_PATTERNS = [
        r"(?:>|>>)\s*\S*{name}",          # echo "x" > CLAUDE.md, >> append
        r"tee\s+(?:-a\s+)?\S*{name}",     # tee CLAUDE.md, tee -a CLAUDE.md
        r"sed\s+-i\S*\s+.*\S*{name}",     # sed -i 's/.../.../' CLAUDE.md
        r"mv\s+\S+\s+\S*{name}",          # mv something CLAUDE.md
        r"cp\s+\S+\s+\S*{name}",          # cp something CLAUDE.md
        r"truncate\s+.*\S*{name}",         # truncate -s 0 CLAUDE.md
        r"dd\s+.*of=\S*{name}",           # dd if=... of=CLAUDE.md
    ]

    for name in _PROTECTED_FILE_NAMES:
        # Escape regex special chars in filename
        escaped_name = re.escape(name)
        for pattern_template in _BASH_FILE_MOD_PATTERNS:
            pattern = pattern_template.format(name=escaped_name)
            if re.search(pattern, command):
                # Use check_file_protection for consistent message lookup
                _, message = check_file_protection(name)
                if message:
                    return message
                return (
                    f"You are about to modify {name} via Bash command. "
                    "Ensure this change is intentional and reviewed."
                )

    return None


# --- Main logic ---


def handle_bash(tool_input):
    """Bash tool handler -- checks the command for destructive operations.

    Returns (block_message, warn_message) -- block_message causes exit 2,
    warn_message causes systemMessage (exit 0).
    """
    command = tool_input.get("command", "")
    if not command:
        return None, None

    # 1. Indirect execution (eval, sh -c, pipe to shell)
    result = check_indirect_execution(command)
    if result:
        return result, None

    # 2. rm -rf on dangerous paths
    result = check_rm_dangerous(command)
    if result:
        return result, None

    # 3. Alternative deletion tools (find -delete)
    result = check_alternative_deletion(command)
    if result:
        return result, None

    # 4. Docker destructive commands
    result = check_docker_dangerous(command)
    if result:
        return result, None

    # 5. Git destructive commands
    result = check_git_dangerous(command)
    if result:
        return result, None

    # 6. Protected file modification via Bash (warning, not block)
    warn = check_bash_file_modification(command)
    if warn:
        return None, warn

    return None, None


def handle_file_edit(tool_name, tool_input, session_id):
    """Write/Edit/MultiEdit tool handler -- warns when editing protected files.

    Returns (should_warn: bool, message: str).
    The warning is displayed only once per session per file.
    """
    file_path = tool_input.get("file_path", "")
    if not file_path:
        return False, ""

    warning_key, message = check_file_protection(file_path)
    if not warning_key:
        return False, ""

    shown_warnings = load_state(session_id)
    full_key = f"{file_path}-{warning_key}"
    if full_key in shown_warnings:
        return False, ""

    shown_warnings.add(full_key)
    save_state(session_id, shown_warnings)
    return True, message


def main():
    # Check env var that disables the guard
    if os.environ.get("ENABLE_DESTRUCTIVE_GUARD", "1") == "0":
        sys.exit(0)

    # Periodic cleanup of old state files (10% chance)
    if random.random() < 0.1:
        cleanup_old_state_files()

    # Read input data from stdin
    try:
        raw_input_data = sys.stdin.read()
        input_data = json.loads(raw_input_data)
    except json.JSONDecodeError as e:
        debug_log(f"JSON decode error: {e}")
        sys.exit(0)

    session_id = input_data.get("session_id", "default")
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Bash handling
    if tool_name == "Bash":
        block_message, warn_message = handle_bash(tool_input)
        if block_message:
            print(block_message, file=sys.stderr)
            sys.exit(2)
        if warn_message:
            # Protected file modification warning via Bash
            # Once per session per warning
            shown_warnings = load_state(session_id)
            warn_key = f"bash-{warn_message[:50]}"
            if warn_key not in shown_warnings:
                shown_warnings.add(warn_key)
                save_state(session_id, shown_warnings)
                warning_output = json.dumps({"systemMessage": warn_message})
                print(warning_output)
        sys.exit(0)

    # Write/Edit/MultiEdit handling
    if tool_name in ("Write", "Edit", "MultiEdit"):
        should_warn, message = handle_file_edit(tool_name, tool_input, session_id)
        if should_warn:
            warning_output = json.dumps({"systemMessage": message})
            print(warning_output)
            sys.exit(0)
        sys.exit(0)

    # Other tools -- allow
    sys.exit(0)


if __name__ == "__main__":
    main()
