#!/usr/bin/env python3
"""
Security Reminder Hook for Claude Code
This hook checks for security patterns in file edits and warns about potential vulnerabilities.
"""

import json
import os
import random
import sys
from datetime import datetime

# Debug log file
DEBUG_LOG_FILE = "/tmp/security-warnings-log.txt"


def debug_log(message):
    """Append debug message to log file with timestamp."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception as e:
        # Silently ignore logging errors to avoid disrupting the hook
        pass


# State file to track warnings shown (session-scoped using session ID)

# Documentation file extensions that should skip content-based security checks
DOC_EXTENSIONS = [".md", ".txt", ".rst", ".adoc", ".asciidoc", ".html", ".htm"]

# Security patterns configuration
SECURITY_PATTERNS = [
    {
        "ruleName": "github_actions_workflow",
        "path_check": lambda path: ".github/workflows/" in path
        and (path.endswith(".yml") or path.endswith(".yaml")),
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
        "substrings": ["child_process.exec", "exec(", "execSync("],
        "reminder": """Security Warning: Using child_process.exec() can lead to command injection vulnerabilities.

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
        "substrings": ["new Function"],
        "reminder": "Security Warning: Using new Function() with dynamic strings can lead to code injection vulnerabilities. Consider alternative approaches that don't evaluate arbitrary code. Only use new Function() if you truly need to evaluate arbitrary dynamic code.",
    },
    {
        "ruleName": "eval_injection",
        "substrings": ["eval("],
        "reminder": "Security Warning: eval() executes arbitrary code and is a major security risk. Consider using JSON.parse() for data parsing or alternative design patterns that don't require code evaluation. Only use eval() if you truly need to evaluate arbitrary code.",
    },
    {
        "ruleName": "react_dangerously_set_html",
        "substrings": ["dangerouslySetInnerHTML"],
        "reminder": "Security Warning: dangerouslySetInnerHTML can lead to XSS vulnerabilities if used with untrusted content. Ensure all content is properly sanitized using an HTML sanitizer library like DOMPurify, or use safe alternatives.",
    },
    {
        "ruleName": "document_write_xss",
        "substrings": ["document.write"],
        "reminder": "Security Warning: document.write() can be exploited for XSS attacks and has performance issues. Use DOM manipulation methods like createElement() and appendChild() instead.",
    },
    {
        "ruleName": "innerHTML_xss",
        "substrings": [".innerHTML =", ".innerHTML="],
        "reminder": "Security Warning: Setting innerHTML with untrusted content can lead to XSS vulnerabilities. Use textContent for plain text or safe DOM methods for HTML content. If you need HTML support, consider using an HTML sanitizer library such as DOMPurify.",
    },
    {
        "ruleName": "pickle_deserialization",
        "substrings": ["pickle"],
        "reminder": "Security Warning: Using pickle with untrusted content can lead to arbitrary code execution. Consider using JSON or other safe serialization formats instead. Only use pickle if it is explicitly needed or requested by the user.",
    },
    {
        "ruleName": "os_system_injection",
        "substrings": ["os.system", "from os import system"],
        "reminder": "Security Warning: This code appears to use os.system. This should only be used with static arguments and never with arguments that could be user-controlled.",
    },
    {
        "ruleName": "sql_injection_concat",
        "substrings": ["execute(f\"", "execute(f'", 'execute("' + "", "cursor.execute(", ".query(f\"", ".query(f'"],
        "reminder": """Security Warning: Potential SQL injection vulnerability detected.

Never concatenate user input directly into SQL queries. Use parameterized queries instead.

UNSAFE:
  cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
  db.query("SELECT * FROM users WHERE name = '" + name + "'")

SAFE:
  cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
  cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))

Using parameterized queries prevents attackers from injecting malicious SQL code.""",
    },
    {
        "ruleName": "path_traversal",
        "substrings": ["../", "..\\"],
        "reminder": """Security Warning: Potential path traversal vulnerability detected.

The pattern '../' can be used by attackers to access files outside the intended directory.

UNSAFE:
  file_path = base_dir + user_input  # user_input could be '../../../etc/passwd'
  open(request.args.get('file'))

SAFE:
  import os
  safe_path = os.path.normpath(os.path.join(base_dir, user_input))
  if not safe_path.startswith(os.path.abspath(base_dir)):
      raise ValueError("Invalid path")

Always validate and sanitize file paths before use.""",
    },
    {
        "ruleName": "hardcoded_secrets",
        "substrings": [
            "api_key = \"",
            "api_key = '",
            "apiKey = \"",
            "apiKey = '",
            "password = \"",
            "password = '",
            "secret = \"",
            "secret = '",
            "AWS_SECRET_ACCESS_KEY = \"",
            "AWS_SECRET_ACCESS_KEY = '",
        ],
        "reminder": """Security Warning: Potential hardcoded secret detected.

Never hardcode sensitive credentials in source code. They can be exposed through:
- Version control history
- Log files
- Error messages
- Decompiled code

UNSAFE:
  api_key = "sk-1234567890abcdef"
  password = "super_secret_123"

SAFE:
  import os
  api_key = os.environ.get("API_KEY")
  password = os.environ.get("DB_PASSWORD")

Use environment variables, secrets managers (AWS Secrets Manager, HashiCorp Vault), or configuration files excluded from version control.""",
    },
    {
        "ruleName": "subprocess_shell_true",
        "substrings": ["shell=True", "shell = True"],
        "reminder": """Security Warning: Using shell=True in subprocess can lead to command injection.

UNSAFE:
  subprocess.run(f"ls {user_input}", shell=True)
  subprocess.Popen(cmd, shell=True)

SAFE:
  subprocess.run(["ls", user_input], shell=False)
  subprocess.Popen(["ls", user_input])

When shell=True, the command is executed through the shell, allowing shell metacharacters to be interpreted. Use shell=False (default) and pass arguments as a list.""",
    },
    {
        "ruleName": "yaml_unsafe_load",
        "substrings": ["yaml.load(", "yaml.unsafe_load("],
        "reminder": """Security Warning: yaml.load() without Loader can execute arbitrary Python code.

UNSAFE:
  data = yaml.load(user_input)
  data = yaml.unsafe_load(file_content)

SAFE:
  data = yaml.safe_load(user_input)
  data = yaml.load(user_input, Loader=yaml.SafeLoader)

Always use yaml.safe_load() or specify SafeLoader to prevent code execution from malicious YAML.""",
    },
    {
        "ruleName": "jwt_none_algorithm",
        "substrings": ["algorithms=[\"none\"]", "algorithms=['none']", 'algorithm="none"', "algorithm='none'"],
        "reminder": """Security Warning: JWT with 'none' algorithm is insecure.

The 'none' algorithm means no signature verification, allowing attackers to forge tokens.

UNSAFE:
  jwt.decode(token, algorithms=["none"])
  jwt.encode(payload, key, algorithm="none")

SAFE:
  jwt.decode(token, secret, algorithms=["HS256"])
  jwt.encode(payload, secret, algorithm="HS256")

Always use a secure algorithm (HS256, RS256, etc.) and verify signatures.""",
    },
    {
        "ruleName": "prototype_pollution",
        "substrings": ["__proto__", "constructor.prototype", "Object.assign(target,"],
        "reminder": """Security Warning: Potential prototype pollution vulnerability.

Modifying __proto__ or constructor.prototype can affect all objects and lead to security issues.

UNSAFE:
  obj[userKey] = userValue  // if userKey is '__proto__'
  Object.assign(target, untrustedSource)

SAFE:
  if (key === '__proto__' || key === 'constructor') return;
  const safeObj = Object.create(null);
  Object.assign(safeObj, untrustedSource);

Validate object keys and use Object.create(null) for untrusted data.""",
    },
]


def get_state_file(session_id):
    """Get session-specific state file path."""
    return os.path.expanduser(f"~/.claude/security_warnings_state_{session_id}.json")


def cleanup_old_state_files():
    """Remove state files older than 30 days."""
    try:
        state_dir = os.path.expanduser("~/.claude")
        if not os.path.exists(state_dir):
            return

        current_time = datetime.now().timestamp()
        thirty_days_ago = current_time - (30 * 24 * 60 * 60)

        for filename in os.listdir(state_dir):
            if filename.startswith("security_warnings_state_") and filename.endswith(
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
    if os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                return set(json.load(f))
        except (json.JSONDecodeError, IOError):
            return set()
    return set()


def save_state(session_id, shown_warnings):
    """Save the state of shown warnings to file."""
    state_file = get_state_file(session_id)
    try:
        os.makedirs(os.path.dirname(state_file), exist_ok=True)
        with open(state_file, "w") as f:
            json.dump(list(shown_warnings), f)
    except IOError as e:
        debug_log(f"Failed to save state file: {e}")
        pass  # Fail silently if we can't save state


def isDocumentationFile(file_path):
    """Check if file is a documentation file that should skip content checks."""
    normalized_path = file_path.lower()
    return any(normalized_path.endswith(ext) for ext in DOC_EXTENSIONS)


def checkPatterns(file_path, content):
    """Check if file path or content matches any security patterns."""
    # Normalize path by removing leading slashes
    normalized_path = file_path.lstrip("/")

    # Check if this is a documentation file (skip content-based checks)
    is_doc_file = isDocumentationFile(normalized_path)

    for pattern in SECURITY_PATTERNS:
        # Check path-based patterns (always check, even for docs)
        if "path_check" in pattern and pattern["path_check"](normalized_path):
            return pattern["ruleName"], pattern["reminder"]

        # Check content-based patterns (skip for documentation files)
        if "substrings" in pattern and content and not is_doc_file:
            for substring in pattern["substrings"]:
                if substring in content:
                    return pattern["ruleName"], pattern["reminder"]

    return None, None


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
    if tool_name not in ["Edit", "Write", "MultiEdit"]:
        sys.exit(0)  # Allow non-file tools to proceed

    # Extract file path from tool_input
    file_path = tool_input.get("file_path", "")
    if not file_path:
        sys.exit(0)  # Allow if no file path

    # Extract content to check
    content = extract_content_from_input(tool_name, tool_input)

    # Check for security patterns
    rule_name, reminder = checkPatterns(file_path, content)

    if rule_name and reminder:
        # Create unique warning key
        warning_key = f"{file_path}-{rule_name}"

        # Load existing warnings for this session
        shown_warnings = load_state(session_id)

        # Check if we've already shown this warning in this session
        if warning_key not in shown_warnings:
            # Add to shown warnings and save
            shown_warnings.add(warning_key)
            save_state(session_id, shown_warnings)

            # Output the warning to stderr and block execution
            print(reminder, file=sys.stderr)
            sys.exit(2)  # Block tool execution (exit code 2 for PreToolUse hooks)

    # Allow tool to proceed
    sys.exit(0)


if __name__ == "__main__":
    main()
