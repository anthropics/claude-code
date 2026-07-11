#!/usr/bin/env python3
"""
Security Reminder Hook for Claude Code
This hook checks for security patterns in file edits and warns about potential vulnerabilities.
"""

import hashlib
import json
import os
import random
import re
import stat
import sys
import tempfile
from datetime import datetime

# Debug log file
DEBUG_LOG_FILE = "/tmp/security-warnings-log.txt"
STATE_FILE_PREFIX = "security_warnings_state_"
VALID_SESSION_ID = re.compile(r"\A[A-Za-z0-9_-]{1,128}\Z")

CHILD_PROCESS_NAMESPACE_IMPORTS = (
    re.compile(
        r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"
        r"require\s*\(\s*['\"](?:node:)?child_process['\"]\s*\)",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bimport\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?"
        r"\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s*"
        r"['\"](?:node:)?child_process['\"]",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bimport\s+([A-Za-z_$][\w$]*)\s*"
        r"(?:,\s*(?:\{[^{}]*\}|\*\s*as\s+[A-Za-z_$][\w$]*))?\s+from\s*"
        r"['\"](?:node:)?child_process['\"]",
        re.IGNORECASE,
    ),
)
CHILD_PROCESS_NAMED_IMPORTS = (
    re.compile(
        r"\bimport\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?"
        r"\{([^{}]*)\}\s*from\s*"
        r"['\"](?:node:)?child_process['\"]",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:const|let|var)\s*\{([^{}]*)\}\s*=\s*"
        r"require\s*\(\s*['\"](?:node:)?child_process['\"]\s*\)",
        re.IGNORECASE,
    ),
)
CHILD_PROCESS_DIRECT_REQUIRE_EXEC = re.compile(
    r"\brequire\s*\(\s*['\"](?:node:)?child_process['\"]\s*\)"
    r"\s*\.\s*exec(?:Sync)?\s*\(",
    re.IGNORECASE,
)


def _named_child_process_exec_aliases(content):
    """Return local names bound to exec/execSync by named imports."""
    aliases = set()
    binding_pattern = re.compile(
        r"\s*(exec(?:Sync)?)(?:(?:\s+as\s+|\s*:\s*)"
        r"([A-Za-z_$][\w$]*))?\s*\Z",
        re.IGNORECASE,
    )
    for import_pattern in CHILD_PROCESS_NAMED_IMPORTS:
        for import_match in import_pattern.finditer(content):
            for binding in import_match.group(1).split(","):
                binding_match = binding_pattern.fullmatch(binding)
                if binding_match:
                    aliases.add(binding_match.group(2) or binding_match.group(1))
    return aliases


def uses_child_process_namespace_exec(content):
    """Detect exec calls imported or required from child_process."""
    if CHILD_PROCESS_DIRECT_REQUIRE_EXEC.search(content):
        return True

    namespace_aliases = {
        match.group(1)
        for import_pattern in CHILD_PROCESS_NAMESPACE_IMPORTS
        for match in import_pattern.finditer(content)
    }
    if any(
        re.search(
            rf"(?<![\w$]){re.escape(alias)}\s*\.\s*exec(?:Sync)?\s*\(",
            content,
        )
        for alias in namespace_aliases
    ):
        return True

    return any(
        re.search(
            rf"(?<![\w$.]){re.escape(alias)}\s*\(",
            content,
        )
        for alias in _named_child_process_exec_aliases(content)
    )


def debug_log(message):
    """Append debug message to log file with timestamp."""
    file_descriptor = None
    try:
        flags = os.O_WRONLY | os.O_APPEND | os.O_CREAT
        if hasattr(os, "O_CLOEXEC"):
            flags |= os.O_CLOEXEC
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW

        file_descriptor = os.open(DEBUG_LOG_FILE, flags, 0o600)
        opened_stat = os.fstat(file_descriptor)
        path_stat = os.lstat(DEBUG_LOG_FILE)
        current_uid = os.getuid() if hasattr(os, "getuid") else opened_stat.st_uid
        if (
            not stat.S_ISREG(opened_stat.st_mode)
            or not stat.S_ISREG(path_stat.st_mode)
            or opened_stat.st_dev != path_stat.st_dev
            or opened_stat.st_ino != path_stat.st_ino
            or opened_stat.st_uid != current_uid
        ):
            return

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with os.fdopen(file_descriptor, "a", encoding="utf-8") as log_handle:
            file_descriptor = None
            log_handle.write(f"[{timestamp}] {message}\n")
    except (OSError, ValueError):
        # Silently ignore logging errors to avoid disrupting the hook
        pass
    finally:
        if file_descriptor is not None:
            try:
                os.close(file_descriptor)
            except OSError:
                pass


# State file to track warnings shown (session-scoped using session ID)

# Security patterns configuration
SECURITY_PATTERNS = [
    {
        "ruleName": "github_actions_workflow",
        "path_check": lambda path: ".github/workflows/" in path.lower()
        and path.lower().endswith((".yml", ".yaml")),
        "reminder": """You are editing a GitHub Actions workflow file. Be aware of these security risks:

1. **Command Injection**: Never use untrusted input (like issue titles, PR descriptions, commit messages) directly in run: commands without proper escaping
2. **Use environment variables**: Instead of ${{ github.event.issue.title }}, use env: with proper quoting
3. **Review the guide**: https://github.blog/security/vulnerability-research/how-to-catch-github-actions-workflow-injections-before-attackers-do/

Example of UNSAFE pattern to avoid:
run: echo "${{ github.event.issue.title }}"

Example of SAFE pattern:
env:
  TITLE: ${{ github.event.issue.title }}
run: echo "$TITLE"

Other risky inputs to be careful with:
- github.event.issue.body
- github.event.pull_request.title
- github.event.pull_request.body
- github.event.comment.body
- github.event.review.body
- github.event.review_comment.body
- github.event.pages.*.page_name
- github.event.commits.*.message
- github.event.head_commit.message
- github.event.head_commit.author.email
- github.event.head_commit.author.name
- github.event.commits.*.author.email
- github.event.commits.*.author.name
- github.event.pull_request.head.ref
- github.event.pull_request.head.label
- github.event.pull_request.head.repo.default_branch
- github.head_ref""",
    },
    {
        "ruleName": "child_process_exec",
        "content_patterns": [
            re.compile(r"\bchild_process\s*\.\s*exec(?:sync)?\s*\(", re.IGNORECASE),
            # Match an imported/bare exec call, but not regex.exec(), object.exec(),
            # or identifiers such as myexec().
            re.compile(r"(?<![\w.])exec(?:sync)?\s*\(", re.IGNORECASE),
        ],
        "content_check": uses_child_process_namespace_exec,
        "reminder": """⚠️ Security Warning: Using child_process.exec() can lead to command injection vulnerabilities.

This codebase provides a safer alternative: src/utils/execFileNoThrow.ts

Instead of:
  exec(`command ${userInput}`)

Use:
  import { execFileNoThrow } from '../utils/execFileNoThrow.js'
  await execFileNoThrow('command', [userInput])

The execFileNoThrow utility:
- Uses execFile instead of exec (prevents shell injection)
- Handles Windows compatibility automatically
- Provides proper error handling
- Returns structured output with stdout, stderr, and status

Only use exec() if you absolutely need shell features and the input is guaranteed to be safe.""",
    },
    {
        "ruleName": "new_function_injection",
        "content_patterns": [
            re.compile(r"\bnew\s+function\s*\(", re.IGNORECASE),
        ],
        "reminder": "⚠️ Security Warning: Using new Function() with dynamic strings can lead to code injection vulnerabilities. Consider alternative approaches that don't evaluate arbitrary code. Only use new Function() if you truly need to evaluate arbitrary dynamic code.",
    },
    {
        "ruleName": "eval_injection",
        "content_patterns": [
            re.compile(r"(?<![\w.])eval\s*\(", re.IGNORECASE),
        ],
        "reminder": "⚠️ Security Warning: eval() executes arbitrary code and is a major security risk. Consider using JSON.parse() for data parsing or alternative design patterns that don't require code evaluation. Only use eval() if you truly need to evaluate arbitrary code.",
    },
    {
        "ruleName": "react_dangerously_set_html",
        "content_patterns": [
            re.compile(r"\bdangerouslySetInnerHTML\b"),
        ],
        "reminder": "⚠️ Security Warning: dangerouslySetInnerHTML can lead to XSS vulnerabilities if used with untrusted content. Ensure all content is properly sanitized using an HTML sanitizer library like DOMPurify, or use safe alternatives.",
    },
    {
        "ruleName": "document_write_xss",
        "content_patterns": [
            re.compile(r"\bdocument\s*\.\s*write\s*\(", re.IGNORECASE),
        ],
        "reminder": "⚠️ Security Warning: document.write() can be exploited for XSS attacks and has performance issues. Use DOM manipulation methods like createElement() and appendChild() instead.",
    },
    {
        "ruleName": "innerHTML_xss",
        "content_patterns": [
            re.compile(r"\.\s*innerHTML\s*=", re.IGNORECASE),
        ],
        "reminder": "⚠️ Security Warning: Setting innerHTML with untrusted content can lead to XSS vulnerabilities. Use textContent for plain text or safe DOM methods for HTML content. If you need HTML support, consider using an HTML sanitizer library such as DOMPurify.",
    },
    {
        "ruleName": "pickle_deserialization",
        "content_patterns": [
            re.compile(r"\bpickle\b", re.IGNORECASE),
        ],
        "reminder": "⚠️ Security Warning: Using pickle with untrusted content can lead to arbitrary code execution. Consider using JSON or other safe serialization formats instead. Only use pickle if it is explicitly needed or requested by the user.",
    },
    {
        "ruleName": "os_system_injection",
        "content_patterns": [
            re.compile(r"\bos\s*\.\s*system\s*\(", re.IGNORECASE),
            re.compile(r"\bfrom\s+os\s+import\s+system\b", re.IGNORECASE),
        ],
        "reminder": "⚠️ Security Warning: This code appears to use os.system. This should only be used with static arguments and never with arguments that could be user-controlled.",
    },
]


def get_state_file(session_id):
    """Get a state path that cannot escape the per-user state directory."""
    if isinstance(session_id, str) and VALID_SESSION_ID.fullmatch(session_id):
        state_key = session_id
    else:
        # Hook input normally contains a runtime-generated identifier, but stdin
        # is still an input boundary. Hash malformed values instead of allowing
        # separators, traversal components, or unbounded names into a path.
        serialized = json.dumps(
            session_id,
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        )
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        state_key = f"invalid-{digest}"

    state_dir = os.path.expanduser("~/.claude")
    return os.path.join(state_dir, f"{STATE_FILE_PREFIX}{state_key}.json")


def cleanup_old_state_files():
    """Remove state files older than 30 days."""
    try:
        state_dir = os.path.expanduser("~/.claude")
        if not os.path.exists(state_dir):
            return

        current_time = datetime.now().timestamp()
        thirty_days_ago = current_time - (30 * 24 * 60 * 60)

        for filename in os.listdir(state_dir):
            if filename.startswith(STATE_FILE_PREFIX) and filename.endswith(
                ".json"
            ):
                file_path = os.path.join(state_dir, filename)
                try:
                    file_mtime = os.path.getmtime(file_path)
                    if file_mtime < thirty_days_ago:
                        os.remove(file_path)
                except (OSError, IOError):
                    pass  # Ignore errors for individual file cleanup
    except Exception:
        pass  # Silently ignore cleanup errors


def load_state(session_id):
    """Load the state of shown warnings from file."""
    state_file = get_state_file(session_id)
    file_descriptor = None

    try:
        path_stat = os.lstat(state_file)
        if not stat.S_ISREG(path_stat.st_mode):
            debug_log(f"Refusing non-regular state file: {state_file}")
            return set()

        flags = os.O_RDONLY
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        file_descriptor = os.open(state_file, flags)

        opened_stat = os.fstat(file_descriptor)
        if (
            not stat.S_ISREG(opened_stat.st_mode)
            or opened_stat.st_dev != path_stat.st_dev
            or opened_stat.st_ino != path_stat.st_ino
        ):
            debug_log(f"State file changed while opening: {state_file}")
            return set()

        with os.fdopen(file_descriptor, "r", encoding="utf-8") as state_handle:
            file_descriptor = None
            state = json.load(state_handle)
        if not isinstance(state, list) or not all(
            isinstance(warning, str) for warning in state
        ):
            return set()
        return set(state)
    except (FileNotFoundError, json.JSONDecodeError, OSError, TypeError):
        return set()
    finally:
        if file_descriptor is not None:
            try:
                os.close(file_descriptor)
            except OSError:
                pass


def save_state(session_id, shown_warnings):
    """Atomically save state without following an existing symlink."""
    state_file = get_state_file(session_id)
    state_dir = os.path.dirname(state_file)
    temporary_path = None

    try:
        os.makedirs(state_dir, mode=0o700, exist_ok=True)

        try:
            existing_stat = os.lstat(state_file)
        except FileNotFoundError:
            existing_stat = None
        if existing_stat is not None and not stat.S_ISREG(existing_stat.st_mode):
            debug_log(f"Refusing non-regular state file: {state_file}")
            return False

        file_descriptor, temporary_path = tempfile.mkstemp(
            dir=state_dir,
            prefix=f".{STATE_FILE_PREFIX}",
            suffix=".tmp",
            text=True,
        )
        with os.fdopen(file_descriptor, "w", encoding="utf-8") as state_handle:
            json.dump(sorted(shown_warnings), state_handle)
            state_handle.flush()
            os.fsync(state_handle.fileno())

        # Recheck before replacement. os.replace replaces a raced-in symlink as
        # a directory entry and never follows it to the symlink target.
        try:
            existing_stat = os.lstat(state_file)
        except FileNotFoundError:
            existing_stat = None
        if existing_stat is not None and not stat.S_ISREG(existing_stat.st_mode):
            debug_log(f"Refusing non-regular state file: {state_file}")
            return False

        os.replace(temporary_path, state_file)
        temporary_path = None
        return True
    except OSError as e:
        debug_log(f"Failed to save state file: {e}")
        return False  # Fail silently if we can't save state
    finally:
        if temporary_path is not None:
            try:
                os.unlink(temporary_path)
            except OSError:
                pass


def check_patterns(file_path, content):
    """Return every distinct security pattern matched by the path or content."""
    # Claude Code may provide POSIX or Windows paths regardless of the host OS.
    normalized_path = file_path.replace("\\", "/").lstrip("/")
    matches = []

    for pattern in SECURITY_PATTERNS:
        if "path_check" in pattern and pattern["path_check"](normalized_path):
            matches.append((pattern["ruleName"], pattern["reminder"]))
            continue

        if content and (
            any(
                regex.search(content)
                for regex in pattern.get("content_patterns", [])
            )
            or pattern.get("content_check", lambda _: False)(content)
        ):
            matches.append((pattern["ruleName"], pattern["reminder"]))

    return matches


def extract_content_from_input(tool_name, tool_input):
    """Extract content to check from tool input based on tool type."""
    if tool_name == "Write":
        return tool_input.get("content", "")
    elif tool_name == "Edit":
        return tool_input.get("new_string", "")
    elif tool_name == "MultiEdit":
        edits = tool_input.get("edits", [])
        if edits:
            return " ".join(edit.get("new_string", "") for edit in edits)
        return ""
    elif tool_name == "NotebookEdit":
        return tool_input.get("new_source", "")

    return ""


def main():
    """Main hook function."""
    # Check if security reminders are enabled
    security_reminder_enabled = os.environ.get("ENABLE_SECURITY_REMINDER", "1")

    # Only run if security reminders are enabled
    if security_reminder_enabled == "0":
        sys.exit(0)

    # Periodically clean up old state files (10% chance per run)
    if random.random() < 0.1:
        cleanup_old_state_files()

    # Read input from stdin
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except json.JSONDecodeError as e:
        debug_log(f"JSON decode error: {e}")
        sys.exit(0)  # Allow tool to proceed if we can't parse input

    # Extract session ID and tool information from the hook input
    session_id = input_data.get("session_id", "default")
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Check if this is a relevant tool
    if tool_name not in ["Edit", "Write", "MultiEdit", "NotebookEdit"]:
        sys.exit(0)  # Allow non-file tools to proceed

    # Extract file path from tool_input
    path_key = "notebook_path" if tool_name == "NotebookEdit" else "file_path"
    file_path = tool_input.get(path_key, "")
    if not file_path:
        sys.exit(0)  # Allow if no file path

    # Extract content to check
    content = extract_content_from_input(tool_name, tool_input)

    findings = check_patterns(file_path, content)
    if findings:
        shown_warnings = load_state(session_id)
        new_findings = []

        for rule_name, reminder in findings:
            warning_key = f"{file_path}-{rule_name}"
            if warning_key not in shown_warnings:
                shown_warnings.add(warning_key)
                new_findings.append(reminder)

        if new_findings:
            # Persist every finding before blocking. A retry then suppresses only
            # warnings already shown while still allowing newly introduced rules.
            save_state(session_id, shown_warnings)
            print("\n\n".join(new_findings), file=sys.stderr)
            sys.exit(2)  # Block tool execution (exit code 2 for PreToolUse hooks)

    # Allow tool to proceed
    sys.exit(0)


if __name__ == "__main__":
    main()
