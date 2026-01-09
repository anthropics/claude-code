#!/usr/bin/env python3
"""
validate-file.py - Post-edit validation hook for code quality checks
Runs language-specific linters after file edits (Edit/Write tools)

Exit codes:
  0 = Success (JSON output for structured feedback)
  2 = Blocking error (stderr fed to Claude)
  Other = Non-blocking error
"""

import json
import sys
import subprocess
import os
from pathlib import Path
from typing import Optional

def run_command(cmd: list, timeout: int = 30) -> tuple[int, str, str]:
    """Run a command and return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"
    except FileNotFoundError:
        return -2, "", f"Command not found: {cmd[0]}"

def validate_python(file_path: str) -> list[dict]:
    """Validate Python files with multiple tools."""
    issues = []

    # Python compile check
    code, out, err = run_command(["python3", "-m", "py_compile", file_path])
    if code != 0:
        issues.append({
            "tool": "py_compile",
            "severity": "error",
            "message": f"Syntax error: {err.strip()}"
        })
        return issues  # Don't continue if syntax error

    # Ruff linting
    code, out, err = run_command(["ruff", "check", "--output-format=json", file_path])
    if code == 0:
        pass  # Clean
    elif code > 0 and out:
        try:
            ruff_issues = json.loads(out)
            for issue in ruff_issues[:5]:  # Limit to first 5
                issues.append({
                    "tool": "ruff",
                    "severity": "warning",
                    "message": f"Line {issue.get('location', {}).get('row', '?')}: {issue.get('code', '')} - {issue.get('message', '')}"
                })
        except json.JSONDecodeError:
            issues.append({"tool": "ruff", "severity": "warning", "message": out.strip()[:200]})

    # Type checking with mypy (non-blocking)
    code, out, err = run_command(["mypy", "--ignore-missing-imports", file_path])
    if code != 0 and out:
        for line in out.strip().split("\n")[:3]:  # Limit to first 3
            if "error:" in line:
                issues.append({
                    "tool": "mypy",
                    "severity": "warning",
                    "message": line.strip()[:150]
                })

    return issues

def validate_javascript(file_path: str) -> list[dict]:
    """Validate JavaScript/TypeScript files."""
    issues = []

    # JSHint for JavaScript
    if file_path.endswith(".js"):
        code, out, err = run_command(["npx", "jshint", file_path])
        if code != 0 and out:
            for line in out.strip().split("\n")[:5]:
                if line.strip():
                    issues.append({
                        "tool": "jshint",
                        "severity": "warning",
                        "message": line.strip()[:150]
                    })

    # ESLint for JS/TS
    code, out, err = run_command(["npx", "eslint", "--format=compact", file_path])
    if code != 0 and out:
        for line in out.strip().split("\n")[:5]:
            if line.strip() and "error" in line.lower():
                issues.append({
                    "tool": "eslint",
                    "severity": "warning",
                    "message": line.strip()[:150]
                })

    # TypeScript type check
    if file_path.endswith((".ts", ".tsx")):
        code, out, err = run_command(["npx", "tsc", "--noEmit", "--skipLibCheck", file_path])
        if code != 0 and (out or err):
            output = out or err
            for line in output.strip().split("\n")[:3]:
                if "error" in line.lower():
                    issues.append({
                        "tool": "tsc",
                        "severity": "error",
                        "message": line.strip()[:150]
                    })

    return issues

def validate_rust(file_path: str) -> list[dict]:
    """Validate Rust files."""
    issues = []

    # Find Cargo.toml to determine if we're in a Cargo project
    path = Path(file_path).parent
    cargo_toml = None
    for parent in [path] + list(path.parents):
        if (parent / "Cargo.toml").exists():
            cargo_toml = parent / "Cargo.toml"
            break

    if cargo_toml:
        project_dir = cargo_toml.parent

        # Cargo check
        code, out, err = run_command(
            ["cargo", "check", "--message-format=short"],
            timeout=60
        )
        if code != 0 and err:
            for line in err.strip().split("\n")[:5]:
                if "error" in line.lower():
                    issues.append({
                        "tool": "cargo check",
                        "severity": "error",
                        "message": line.strip()[:150]
                    })

        # Clippy (non-blocking warnings)
        code, out, err = run_command(
            ["cargo", "clippy", "--message-format=short", "--", "-W", "clippy::all"],
            timeout=60
        )
        if err:
            for line in err.strip().split("\n")[:3]:
                if "warning" in line.lower():
                    issues.append({
                        "tool": "clippy",
                        "severity": "warning",
                        "message": line.strip()[:150]
                    })
    else:
        # Standalone Rust file - basic syntax check
        code, out, err = run_command(["rustc", "--emit=metadata", "-o", "/dev/null", file_path])
        if code != 0 and err:
            issues.append({
                "tool": "rustc",
                "severity": "error",
                "message": err.strip()[:200]
            })

    return issues

def validate_json(file_path: str) -> list[dict]:
    """Validate JSON files."""
    issues = []
    code, out, err = run_command(["jq", ".", file_path])
    if code != 0:
        issues.append({
            "tool": "jq",
            "severity": "error",
            "message": f"Invalid JSON: {err.strip()[:100]}"
        })
    return issues

def check_spelling(file_path: str) -> list[dict]:
    """Check spelling in code comments and strings."""
    issues = []
    code, out, err = run_command(["codespell", "--quiet-level=2", file_path])
    if code != 0 and out:
        for line in out.strip().split("\n")[:3]:
            if line.strip():
                issues.append({
                    "tool": "codespell",
                    "severity": "info",
                    "message": line.strip()[:100]
                })
    return issues

def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    if tool_name not in ["Edit", "Write"]:
        sys.exit(0)

    file_path = input_data.get("tool_input", {}).get("file_path", "")
    if not file_path or not os.path.exists(file_path):
        sys.exit(0)

    # Determine file type and run appropriate validators
    issues = []

    if file_path.endswith(".py"):
        issues.extend(validate_python(file_path))
    elif file_path.endswith((".js", ".ts", ".jsx", ".tsx")):
        issues.extend(validate_javascript(file_path))
    elif file_path.endswith(".rs"):
        issues.extend(validate_rust(file_path))
    elif file_path.endswith(".json"):
        issues.extend(validate_json(file_path))

    # Optional spelling check (non-blocking)
    if os.environ.get("CHECK_SPELLING", "false").lower() == "true":
        issues.extend(check_spelling(file_path))

    # Report results
    if issues:
        errors = [i for i in issues if i["severity"] == "error"]
        warnings = [i for i in issues if i["severity"] == "warning"]

        # Build feedback message
        feedback_parts = []
        if errors:
            feedback_parts.append(f"Errors ({len(errors)}):")
            for err in errors[:3]:
                feedback_parts.append(f"  [{err['tool']}] {err['message']}")
        if warnings:
            feedback_parts.append(f"Warnings ({len(warnings)}):")
            for warn in warnings[:3]:
                feedback_parts.append(f"  [{warn['tool']}] {warn['message']}")

        feedback = "\n".join(feedback_parts)

        # If there are errors, return blocking feedback
        if errors:
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "decision": "block",
                    "reason": f"Quality checks failed for {os.path.basename(file_path)}:\n{feedback}"
                }
            }
            print(json.dumps(output))
            sys.exit(0)
        else:
            # Warnings only - non-blocking but inform
            print(f"Quality checks for {os.path.basename(file_path)}:\n{feedback}")
            sys.exit(0)
    else:
        print(f"✓ Quality checks passed for {os.path.basename(file_path)}")
        sys.exit(0)

if __name__ == "__main__":
    main()
