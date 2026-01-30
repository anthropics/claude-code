"""Verify lint clean claims by running linters."""

import shlex
import subprocess
from typing import Any

from .base import VerificationResult
from .command_detection import (
    file_exists,
    read_package_json,
    read_pyproject_toml,
)


def detect_lint_command(cwd: str) -> tuple[str, str] | None:
    """
    Detect the appropriate lint command for the project.

    Args:
        cwd: Current working directory

    Returns:
        Tuple of (command, linter_name) or None if not detected
    """
    # Node.js/npm projects
    pkg = read_package_json(cwd)
    if pkg:
        scripts = pkg.get("scripts", {})
        if "lint" in scripts:
            return ("npm run lint", "npm")
        # Check for eslint config
        if file_exists(cwd, ".eslintrc.js", ".eslintrc.json", "eslint.config.js"):
            return ("npx eslint .", "eslint")

    # Python projects with ruff
    if file_exists(cwd, "ruff.toml", ".ruff.toml"):
        return ("ruff check .", "ruff")

    # Python projects - check pyproject.toml for tools
    content = read_pyproject_toml(cwd)
    if content:
        if "[tool.ruff" in content:
            return ("ruff check .", "ruff")
        if "[tool.flake8" in content or "[tool.pylint" in content:
            return ("flake8 .", "flake8")

    # Python with pylint or flake8 config
    if file_exists(cwd, ".pylintrc"):
        return ("pylint **/*.py", "pylint")
    if file_exists(cwd, ".flake8"):
        return ("flake8", "flake8")

    # Rust projects
    if file_exists(cwd, "Cargo.toml"):
        return ("cargo clippy -- -D warnings", "clippy")

    # Go projects
    if file_exists(cwd, "go.mod"):
        return ("golangci-lint run", "golangci-lint")

    return None


def verify_lint_clean(claim_value: str | None, cwd: str,
                      config: dict[str, Any]) -> VerificationResult:
    """
    Verify that linting passes with no errors.

    Args:
        claim_value: Not used for lint verification
        cwd: Current working directory
        config: Verifier configuration

    Returns:
        VerificationResult indicating if lint passes
    """
    timeout = config.get("timeout", 30)
    custom_command = config.get("command")

    # Use custom command if specified
    if custom_command:
        lint_command = custom_command
        linter = "custom"
    else:
        # Auto-detect lint command
        detected = detect_lint_command(cwd)
        if detected is None:
            return VerificationResult(
                passed=True,
                message="No linter detected, skipping verification",
                details={"skipped": True, "reason": "no_linter"}
            )
        lint_command, linter = detected

    try:
        result = subprocess.run(
            shlex.split(lint_command),
            shell=False,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout
        )

        if result.returncode == 0:
            return VerificationResult(
                passed=True,
                message=f"Lint passed ({linter})",
                details={
                    "command": lint_command,
                    "linter": linter,
                    "exit_code": result.returncode
                }
            )
        else:
            # Extract lint errors
            output = result.stdout + result.stderr
            output_tail = output[-1000:] if output else "No output"

            return VerificationResult(
                passed=False,
                message=f"Lint errors found ({linter})",
                details={
                    "command": lint_command,
                    "linter": linter,
                    "exit_code": result.returncode,
                    "output_tail": output_tail
                }
            )

    except subprocess.TimeoutExpired:
        return VerificationResult(
            passed=False,
            message=f"Lint check timed out after {timeout}s",
            details={
                "command": lint_command,
                "linter": linter,
                "timeout": timeout,
                "error": "timeout"
            }
        )
    except Exception as e:
        return VerificationResult(
            passed=False,
            message=f"Failed to run linter: {str(e)}",
            details={
                "command": lint_command,
                "linter": linter,
                "error": str(e)
            }
        )
