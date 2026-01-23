#!/usr/bin/env python3
"""
Enhanced Security Reminder Hook for Claude Code
This hook checks for security patterns in file edits and warns about potential vulnerabilities.
Enhanced with better error handling, performance improvements, and additional security patterns.
"""

import json
import os
import random
import sys
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Set

# Debug log file
DEBUG_LOG_FILE = "/tmp/security-warnings-log.txt"

# Configuration
MAX_CONTENT_LENGTH = 10000  # Limit content checking for performance
CLEANUP_PROBABILITY = 0.1   # 10% chance to clean up old files
STATE_FILE_RETENTION_DAYS = 30


def debug_log(message: str) -> None:
    """Append debug message to log file with timestamp."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        # Silently ignore logging errors to avoid disrupting the hook
        pass


class SecurityPattern:
    """Represents a security pattern to check for."""
    
    def __init__(self, rule_name: str, reminder: str, 
                 path_check: Optional[callable] = None, 
                 substrings: Optional[List[str]] = None,
                 regex_patterns: Optional[List[str]] = None,
                 severity: str = "warning"):
        self.rule_name = rule_name
        self.reminder = reminder
        self.path_check = path_check
        self.substrings = substrings or []
        self.regex_patterns = regex_patterns or []
        self.severity = severity
        self._compiled_regexes = [re.compile(pattern, re.IGNORECASE) for pattern in self.regex_patterns]
    
    def matches(self, file_path: str, content: str) -> bool:
        """Check if this pattern matches the given file path or content."""
        # Check path-based patterns
        if self.path_check and self.path_check(file_path):
            return True
        
        # Check substring patterns
        if self.substrings and content:
            content_lower = content.lower()
            for substring in self.substrings:
                if substring.lower() in content_lower:
                    return True
        
        # Check regex patterns
        if self._compiled_regexes and content:
            for regex in self._compiled_regexes:
                if regex.search(content):
                    return True
        
        return False


# Enhanced security patterns configuration
SECURITY_PATTERNS = [
    SecurityPattern(
        rule_name="github_actions_workflow",
        path_check=lambda path: ".github/workflows/" in path
        and (path.endswith(".yml") or path.endswith(".yaml")),
        reminder="""🔒 GitHub Actions Security Warning

You are editing a GitHub Actions workflow file. Be aware of these security risks:

1. **Command Injection**: Never use untrusted input directly in run: commands
2. **Use environment variables**: Instead of ${{ github.event.issue.title }}, use env: with proper quoting
3. **Review the guide**: https://github.blog/security/vulnerability-research/how-to-catch-github-actions-workflow-injections-before-attackers-do/

Example of UNSAFE pattern to avoid:
```yaml
run: echo "${{ github.event.issue.title }}"
```

Example of SAFE pattern:
```yaml
env:
  TITLE: ${{ github.event.issue.title }}
run: echo "$TITLE"
```

Risky inputs to be careful with:
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
        severity="high"
    ),
    
    SecurityPattern(
        rule_name="child_process_exec",
        substrings=["child_process.exec", "exec(", "execSync("],
        reminder="""⚠️ Command Injection Warning

Using child_process.exec() can lead to command injection vulnerabilities.

This codebase provides a safer alternative: src/utils/execFileNoThrow.ts

Instead of:
```javascript
exec(`command ${userInput}`)
```

Use:
```javascript
import { execFileNoThrow } from '../utils/execFileNoThrow.js'
await execFileNoThrow('command', [userInput])
```

The execFileNoThrow utility:
- Uses execFile instead of exec (prevents shell injection)
- Handles Windows compatibility automatically
- Provides proper error handling
- Returns structured output with stdout, stderr, and status

Only use exec() if you absolutely need shell features and the input is guaranteed to be safe.""",
        severity="high"
    ),
    
    SecurityPattern(
        rule_name="new_function_injection",
        substrings=["new Function"],
        reminder="""⚠️ Code Injection Warning

Using new Function() with dynamic strings can lead to code injection vulnerabilities. 

Consider alternative approaches:
- Use JSON.parse() for data parsing
- Use template literals with safe data
- Use proper validation and sanitization

Only use new Function() if you truly need to evaluate arbitrary dynamic code and have proper input validation.""",
        severity="high"
    ),
    
    SecurityPattern(
        rule_name="eval_injection",
        substrings=["eval("],
        reminder="""⚠️ Code Injection Warning

eval() executes arbitrary code and is a major security risk.

Safer alternatives:
- Use JSON.parse() for data parsing
- Use template literals with safe data
- Use proper validation and sanitization
- Consider using a safe expression evaluator library

Only use eval() if you truly need to evaluate arbitrary code and have proper input validation.""",
        severity="critical"
    ),
    
    SecurityPattern(
        rule_name="react_dangerously_set_html",
        substrings=["dangerouslySetInnerHTML"],
        reminder="""⚠️ XSS Warning

dangerouslySetInnerHTML can lead to XSS vulnerabilities if used with untrusted content.

Ensure all content is properly sanitized:
- Use DOMPurify for HTML sanitization
- Validate and escape all user input
- Consider using safe alternatives like textContent

Example with DOMPurify:
```javascript
import DOMPurify from 'dompurify';
const sanitizedHTML = DOMPurify.sanitize(userContent);
```""",
        severity="high"
    ),
    
    SecurityPattern(
        rule_name="document_write_xss",
        substrings=["document.write"],
        reminder="""⚠️ XSS Warning

document.write() can be exploited for XSS attacks and has performance issues.

Use safer DOM manipulation methods:
- createElement() and appendChild()
- innerHTML with sanitized content
- textContent for plain text
- Modern frameworks like React, Vue, or Angular""",
        severity="medium"
    ),
    
    SecurityPattern(
        rule_name="innerHTML_xss",
        substrings=[".innerHTML =", ".innerHTML="],
        reminder="""⚠️ XSS Warning

Setting innerHTML with untrusted content can lead to XSS vulnerabilities.

Safer alternatives:
- Use textContent for plain text
- Use safe DOM methods for HTML content
- Use DOMPurify for HTML sanitization

Example with DOMPurify:
```javascript
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userContent);
```""",
        severity="high"
    ),
    
    SecurityPattern(
        rule_name="pickle_deserialization",
        substrings=["pickle"],
        reminder="""⚠️ Code Execution Warning

Using pickle with untrusted content can lead to arbitrary code execution.

Safer alternatives:
- Use JSON for data serialization
- Use msgpack for binary data
- Use protobuf for structured data
- Use custom serialization with validation

Only use pickle if it is explicitly needed and the data source is trusted.""",
        severity="critical"
    ),
    
    SecurityPattern(
        rule_name="os_system_injection",
        substrings=["os.system", "from os import system"],
        reminder="""⚠️ Command Injection Warning

os.system() should only be used with static arguments and never with user-controlled input.

Safer alternatives:
- Use subprocess.run() with proper argument handling
- Use subprocess.Popen() for more control
- Use shlex.quote() for shell argument escaping
- Validate and sanitize all input

Example:
```python
import subprocess
import shlex
subprocess.run(['command', 'arg1', 'arg2'], check=True)
```""",
        severity="high"
    ),
    
    SecurityPattern(
        rule_name="sql_injection",
        regex_patterns=[
            r"execute\s*\(\s*[`\"'].*\+",
            r"query\s*\(\s*[`\"'].*\+",
            r"SELECT.*\+.*user",
            r"INSERT.*\+.*user",
            r"UPDATE.*\+.*user",
            r"DELETE.*\+.*user"
        ],
        reminder="""⚠️ SQL Injection Warning

Direct string concatenation in SQL queries can lead to SQL injection vulnerabilities.

Use parameterized queries:
- Python: Use parameterized queries with placeholders
- Node.js: Use prepared statements
- Use ORMs like SQLAlchemy, Prisma, or Sequelize

Example:
```python
# Unsafe
cursor.execute("SELECT * FROM users WHERE id = " + user_id)

# Safe
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```""",
        severity="high"
    ),
    
    SecurityPattern(
        rule_name="path_traversal",
        regex_patterns=[
            r"\.\.\/",
            r"\.\.\\\\",
            r"open\s*\(\s*[`\"'].*\$",
            r"readFile\s*\(\s*[`\"'].*\$"
        ],
        reminder="""⚠️ Path Traversal Warning

File operations with user input can lead to path traversal vulnerabilities.

Prevent directory traversal:
- Validate and sanitize file paths
- Use path.basename() to get filename only
- Use allowlists for allowed directories
- Use proper path resolution

Example:
```python
import os
import pathlib

# Unsafe
with open(user_input, 'r') as f:
    content = f.read()

# Safe
safe_path = pathlib.Path(user_input).resolve()
if str(safe_path).startswith('/allowed/directory/'):
    with open(safe_path, 'r') as f:
        content = f.read()
```""",
        severity="high"
    ),
    
    SecurityPattern(
        rule_name="hardcoded_secrets",
        substrings=["password =", "api_key =", "secret =", "token ="],
        reminder="""⚠️ Hardcoded Secret Warning

Hardcoded secrets in code are a security risk.

Use environment variables or secure secret management:
- Store secrets in environment variables
- Use secret management services (AWS Secrets Manager, Azure Key Vault, etc.)
- Use configuration files that are not committed to version control
- Use proper secret rotation

Example:
```python
import os
api_key = os.environ.get('API_KEY')
if not api_key:
    raise ValueError("API_KEY environment variable is required")
```""",
        severity="medium"
    )
]


def get_state_file(session_id: str) -> str:
    """Get session-specific state file path."""
    return os.path.expanduser(f"~/.claude/security_warnings_state_{session_id}.json")


def cleanup_old_state_files() -> None:
    """Remove state files older than the retention period."""
    try:
        state_dir = os.path.expanduser("~/.claude")
        if not os.path.exists(state_dir):
            return

        current_time = datetime.now().timestamp()
        cutoff_time = current_time - (STATE_FILE_RETENTION_DAYS * 24 * 60 * 60)

        for filename in os.listdir(state_dir):
            if filename.startswith("security_warnings_state_") and filename.endswith(".json"):
                file_path = os.path.join(state_dir, filename)
                try:
                    file_mtime = os.path.getmtime(file_path)
                    if file_mtime < cutoff_time:
                        os.remove(file_path)
                        debug_log(f"Cleaned up old state file: {filename}")
                except (OSError, IOError):
                    pass  # Ignore errors for individual file cleanup
    except Exception as e:
        debug_log(f"Error during cleanup: {e}")


def load_state(session_id: str) -> Set[str]:
    """Load the state of shown warnings from file."""
    state_file = get_state_file(session_id)
    if os.path.exists(state_file):
        try:
            with open(state_file, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except (json.JSONDecodeError, IOError) as e:
            debug_log(f"Error loading state file: {e}")
            return set()
    return set()


def save_state(session_id: str, shown_warnings: Set[str]) -> None:
    """Save the state of shown warnings to file."""
    state_file = get_state_file(session_id)
    try:
        os.makedirs(os.path.dirname(state_file), exist_ok=True)
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(list(shown_warnings), f, indent=2)
    except IOError as e:
        debug_log(f"Failed to save state file: {e}")
        pass  # Fail silently if we can't save state


def check_patterns(file_path: str, content: str) -> Optional[Tuple[str, str]]:
    """Check if file path or content matches any security patterns."""
    # Normalize path by removing leading slashes
    normalized_path = file_path.lstrip("/")
    
    # Limit content length for performance
    if len(content) > MAX_CONTENT_LENGTH:
        content = content[:MAX_CONTENT_LENGTH]
        debug_log(f"Content truncated to {MAX_CONTENT_LENGTH} characters for performance")

    # Check patterns in order of severity (critical first)
    critical_patterns = [p for p in SECURITY_PATTERNS if p.severity == "critical"]
    high_patterns = [p for p in SECURITY_PATTERNS if p.severity == "high"]
    medium_patterns = [p for p in SECURITY_PATTERNS if p.severity == "medium"]
    
    for pattern in critical_patterns + high_patterns + medium_patterns:
        if pattern.matches(normalized_path, content):
            return pattern.rule_name, pattern.reminder

    return None


def extract_content_from_input(tool_name: str, tool_input: Dict) -> str:
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


def main() -> None:
    """Main hook function."""
    try:
        # Check if security reminders are enabled
        security_reminder_enabled = os.environ.get("ENABLE_SECURITY_REMINDER", "1")
        
        # Only run if security reminders are enabled
        if security_reminder_enabled == "0":
            sys.exit(0)

        # Periodically clean up old state files
        if random.random() < CLEANUP_PROBABILITY:
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
        
    except Exception as e:
        debug_log(f"Unexpected error in main: {e}")
        # Allow tool to proceed even if we encounter an error
        sys.exit(0)


if __name__ == "__main__":
    main()