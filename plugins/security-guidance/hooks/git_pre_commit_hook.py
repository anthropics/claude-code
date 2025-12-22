#!/usr/bin/env python3
"""
Git Pre-Commit Secret Detection Hook for Claude Code

This hook intercepts git commit commands and scans staged files for hardcoded
credentials BEFORE the commit happens, regardless of what Claude "thinks" about security.

This is the PARACHUTE that deploys automatically.
"""

import json
import os
import re
import subprocess
import sys

# Secret patterns to detect
SECRET_PATTERNS = [
    {
        "name": "API Keys and Secrets",
        "patterns": [
            r'API_KEY\s*=\s*["\'][^"\']{20,}["\']',
            r'SECRET\s*=\s*["\'][^"\']{20,}["\']',
            r'TOKEN\s*=\s*["\'][^"\']{20,}["\']',
            r'AZURE_API_KEY\s*=\s*["\'][^"\']{20,}["\']',
            r'OPENAI_API_KEY\s*=\s*["\'][^"\']{20,}["\']',
            r'AWS_SECRET_ACCESS_KEY\s*=\s*["\'][^"\']{20,}["\']',
            r'DEEPGRAM_API_KEY\s*=\s*["\'][^"\']{20,}["\']',
        ],
    },
    {
        "name": "Anthropic API Keys",
        "patterns": [r'sk-ant-[a-zA-Z0-9\-_]{95,}'],
    },
    {
        "name": "OpenAI API Keys",
        "patterns": [r'sk-proj-[a-zA-Z0-9]{48,}', r'sk-[a-zA-Z0-9]{48,}'],
    },
    {
        "name": "GitHub Tokens",
        "patterns": [r'ghp_[a-zA-Z0-9]{36,}', r'gho_[a-zA-Z0-9]{36,}'],
    },
    {
        "name": "JWT Tokens",
        "patterns": [r'Bearer\s+eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+'],
    },
    {
        "name": "Azure Connection Strings",
        "patterns": [
            r'DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{88}',
            r'AccountKey=[A-Za-z0-9+/=]{88}',
            r'SharedAccessSignature=sv=',
        ],
    },
    {
        "name": "Database Connection URLs",
        "patterns": [
            r'postgres://[^:]+:[^@]+@',
            r'postgresql://[^:]+:[^@]+@',
            r'mysql://[^:]+:[^@]+@',
            r'mongodb://[^:]+:[^@]+@',
            r'redis://[^:]+:[^@]+@',
        ],
    },
]


def get_staged_files(repo_dir):
    """Get list of files staged for commit."""
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            cwd=repo_dir,
            capture_output=True,
            text=True,
            check=True,
        )
        files = [f for f in result.stdout.strip().split("\n") if f]
        return files
    except subprocess.CalledProcessError:
        return []


def get_file_content(repo_dir, file_path):
    """Get staged content of a file."""
    try:
        result = subprocess.run(
            ["git", "show", f":{file_path}"],
            cwd=repo_dir,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout
    except subprocess.CalledProcessError:
        # File might be newly added, try reading from working directory
        try:
            full_path = os.path.join(repo_dir, file_path)
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception:
            return ""


def scan_content_for_secrets(content, file_path):
    """Scan content for secret patterns."""
    findings = []

    for pattern_group in SECRET_PATTERNS:
        name = pattern_group["name"]
        for pattern in pattern_group["patterns"]:
            matches = re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                # Get line number
                line_num = content[: match.start()].count("\n") + 1
                # Get matched text (truncated for security)
                matched_text = match.group(0)
                if len(matched_text) > 50:
                    matched_text = matched_text[:25] + "..." + matched_text[-10:]

                findings.append(
                    {
                        "file": file_path,
                        "line": line_num,
                        "pattern": name,
                        "match": matched_text,
                    }
                )

    return findings


def main():
    """Main hook function."""
    # Read input from stdin
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except json.JSONDecodeError:
        sys.exit(0)  # Allow if we can't parse input

    # Only trigger on Bash tool with git commit commands
    tool_name = input_data.get("tool_name", "")
    if tool_name != "Bash":
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")

    # Check if this is a git commit command
    if not ("git commit" in command or "git add" in command.lower()):
        sys.exit(0)

    # Determine repository directory from input data (or fallback to os.getcwd())
    cwd = input_data.get("cwd", os.getcwd())

    # If git commit detected, scan staged files
    if "git commit" in command:
        staged_files = get_staged_files(cwd)

        if not staged_files:
            sys.exit(0)  # No files staged, allow

        # Scan all staged files
        all_findings = []
        for file_path in staged_files:
            # Skip binary files and large files
            if file_path.endswith(
                (".png", ".jpg", ".gif", ".pdf", ".zip", ".tar", ".gz", ".exe", ".bin")
            ):
                continue

            content = get_file_content(cwd, file_path)
            if not content:
                continue

            findings = scan_content_for_secrets(content, file_path)
            all_findings.extend(findings)

        if all_findings:
            # Build error message
            error_msg = """
🚨 **CRITICAL: SECRETS DETECTED IN STAGED FILES!**

The following files contain hardcoded credentials and CANNOT be committed:

"""
            for finding in all_findings:
                error_msg += f"""
File: {finding['file']}
Line: {finding['line']}
Pattern: {finding['pattern']}
Match: {finding['match']}
"""

            error_msg += """

**COMMIT BLOCKED FOR YOUR PROTECTION**

Immediate actions required:

1. **Unstage the files with secrets:**
   git reset HEAD <file>

2. **Remove the hardcoded credentials:**
   - Move to environment variables
   - Use placeholders in documentation

3. **Verify with:**
   git diff --cached

4. **If already in history:**
   - Rotate the exposed credentials IMMEDIATELY
   - Clean git history: git filter-repo --invert-paths --path <file>
   - Check service logs for unauthorized usage

**Why this matters:**

Real incidents caused by hardcoded credentials:
- GitHub Issue #12524: $30,000 USD fraud + job termination
- GitHub Issue #2142: Multiple API keys exposed

This automatic check runs REGARDLESS of what Claude "thinks" about security.
It's your safety parachute.

**To bypass this check** (NOT RECOMMENDED):
- Only if these are example/placeholder values
- Only if the repository is truly private
- Add --no-verify flag: git commit --no-verify

But seriously, don't bypass this. It exists for a reason.
"""

            print(error_msg, file=sys.stderr)
            sys.exit(2)  # Block the git commit

    # Allow the command if no secrets detected
    sys.exit(0)


if __name__ == "__main__":
    main()
