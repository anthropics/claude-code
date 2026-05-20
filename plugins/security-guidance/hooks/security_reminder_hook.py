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
        "path_check": lambda path: any(path.endswith(ext) for ext in (".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx")),
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
        "substrings": ["new Function"],
        "reminder": "⚠️ Security Warning: Using new Function() with dynamic strings can lead to code injection vulnerabilities. Consider alternative approaches that don't evaluate arbitrary code. Only use new Function() if you truly need to evaluate arbitrary dynamic code.",
    },
    {
        "ruleName": "eval_injection",
        "substrings": ["eval("],
        "reminder": "⚠️ Security Warning: eval() executes arbitrary code and is a major security risk. Consider using JSON.parse() for data parsing or alternative design patterns that don't require code evaluation. Only use eval() if you truly need to evaluate arbitrary code.",
    },
    {
        "ruleName": "react_dangerously_set_html",
        "substrings": ["dangerouslySetInnerHTML"],
        "reminder": "⚠️ Security Warning: dangerouslySetInnerHTML can lead to XSS vulnerabilities if used with untrusted content. Ensure all content is properly sanitized using an HTML sanitizer library like DOMPurify, or use safe alternatives.",
    },
    {
        "ruleName": "document_write_xss",
        "substrings": ["document.write"],
        "reminder": "⚠️ Security Warning: document.write() can be exploited for XSS attacks and has performance issues. Use DOM manipulation methods like createElement() and appendChild() instead.",
    },
    {
        "ruleName": "innerHTML_xss",
        "substrings": [".innerHTML =", ".innerHTML="],
        "reminder": "⚠️ Security Warning: Setting innerHTML with untrusted content can lead to XSS vulnerabilities. Use textContent for plain text or safe DOM methods for HTML content. If you need HTML support, consider using an HTML sanitizer library such as DOMPurify.",
    },
    {
        "ruleName": "pickle_deserialization",
        "substrings": ["pickle"],
        "reminder": "⚠️ Security Warning: Using pickle with untrusted content can lead to arbitrary code execution. Consider using JSON or other safe serialization formats instead. Only use pickle if it is explicitly needed or requested by the user.",
    },
    {
        "ruleName": "os_system_injection",
        "substrings": ["os.system", "from os import system"],
        "reminder": "⚠️ Security Warning: This code appears to use os.system. This should only be used with static arguments and never with arguments that could be user-controlled.",
    },
    # Java security patterns
    {
        "ruleName": "java_sql_injection",
        "substrings": [
            'Statement statement = ',
            'createStatement()',
            '.execute("',
            '.executeQuery("',
            '.executeUpdate("',
        ],
        "path_check": lambda path: path.endswith(".java"),
        "reminder": """⚠️ Security Warning: Potential SQL injection detected in Java code.

Never concatenate user input into SQL strings. Use PreparedStatement instead:

UNSAFE:
  String sql = "SELECT * FROM users WHERE id = " + userId;
  Statement stmt = conn.createStatement();
  stmt.executeQuery(sql);

SAFE:
  String sql = "SELECT * FROM users WHERE id = ?";
  PreparedStatement stmt = conn.prepareStatement(sql);
  stmt.setInt(1, userId);
  stmt.executeQuery();

If using an ORM (MyBatis/JPA/Hibernate), use parameterized queries or named parameters instead of string interpolation in native queries.""",
    },
    {
        "ruleName": "java_runtime_exec",
        "substrings": ["Runtime.getRuntime().exec(", "new ProcessBuilder("],
        "path_check": lambda path: path.endswith(".java"),
        "reminder": """⚠️ Security Warning: Runtime.exec() or ProcessBuilder with user-controlled input can lead to command injection.

UNSAFE:
  Runtime.getRuntime().exec("ls " + userInput);
  new ProcessBuilder("sh", "-c", userInput).start();

SAFE:
  // Pass arguments as a list, never via shell interpolation
  new ProcessBuilder("ls", sanitizedPath).start();
  // Or use an allowlist to validate commands before execution

Never pass user input directly to shell commands. Use ProcessBuilder with a fixed command and validated arguments.""",
    },
    {
        "ruleName": "java_deserialization",
        "substrings": ["ObjectInputStream", "readObject()"],
        "path_check": lambda path: path.endswith(".java"),
        "reminder": """⚠️ Security Warning: Java deserialization of untrusted data can lead to Remote Code Execution (RCE).

Deserializing data from untrusted sources (network, user uploads, cookies) using ObjectInputStream is dangerous.

Safer alternatives:
- Use JSON (Jackson, Gson) or Protocol Buffers instead of Java serialization
- If Java serialization is required, use a deserialization filter (Java 9+):
    ObjectInputFilter filter = ObjectInputFilter.Config.createFilter("com.example.*;!*");
    ois.setObjectInputFilter(filter);
- Consider using Apache Commons IO's ValidatingObjectInputStream

Never deserialize data from untrusted sources without strict type filtering.""",
    },
    {
        "ruleName": "java_xxe",
        "substrings": [
            "DocumentBuilderFactory.newInstance()",
            "SAXParserFactory.newInstance()",
            "XMLInputFactory.newInstance()",
            "TransformerFactory.newInstance()",
        ],
        "path_check": lambda path: path.endswith(".java"),
        "reminder": """⚠️ Security Warning: XML parsers are vulnerable to XXE (XML External Entity) injection by default.

Always disable external entity processing when parsing untrusted XML:

  DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
  dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
  dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
  dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
  dbf.setExpandEntityReferences(false);

For SAXParserFactory and XMLInputFactory, apply equivalent disabling of external entities. See OWASP XXE Prevention Cheat Sheet for details.""",
    },
    {
        "ruleName": "java_jndi_injection",
        "substrings": ["InitialContext()", "new InitialContext", "context.lookup(", "ctx.lookup("],
        "path_check": lambda path: path.endswith(".java"),
        "reminder": """⚠️ Security Warning: JNDI lookups with user-controlled input can lead to Remote Code Execution (Log4Shell-style vulnerabilities).

UNSAFE:
  InitialContext ctx = new InitialContext();
  ctx.lookup(userControlledString);  // RCE if input is ldap://attacker.com/exploit

SAFE:
- Never pass user-controlled data to JNDI lookup()
- If lookup targets must be dynamic, use an allowlist of permitted JNDI names
- In logging frameworks, set log4j2.formatMsgNoLookups=true or upgrade to Log4j 2.17.1+""",
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


def check_patterns(file_path, content):
    """Check if file path or content matches any security patterns.

    Pattern matching logic:
    - path_check only: triggers on matching file path
    - substrings only: triggers on matching content substring
    - both path_check and substrings: triggers only when BOTH match (AND logic)
    """
    # Normalize path by removing leading slashes
    normalized_path = file_path.lstrip("/")

    for pattern in SECURITY_PATTERNS:
        has_path_check = "path_check" in pattern
        has_substrings = "substrings" in pattern

        if has_path_check and has_substrings:
            # Both conditions must match (AND logic)
            if pattern["path_check"](normalized_path) and content:
                for substring in pattern["substrings"]:
                    if substring in content:
                        return pattern["ruleName"], pattern["reminder"]
        elif has_path_check:
            # Path-only check
            if pattern["path_check"](normalized_path):
                return pattern["ruleName"], pattern["reminder"]
        elif has_substrings and content:
            # Content-only check
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
    rule_name, reminder = check_patterns(file_path, content)

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
